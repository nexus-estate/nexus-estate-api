import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import type { EntityManager } from 'typeorm';
import { BaseRepository } from '../../../../services/abstraction-services';
import { Estate } from '../entities';
import { CreateEstateData } from '../types/estate.type';
import { UpdateEstateDto } from '../dto/update-estate-dto';
import { EstateStatus } from '../types/estate.type';

@Injectable()
export class EstateRepo extends BaseRepository<Estate> {
  constructor(dataSource: DataSource) {
    super(dataSource, Estate, 'Estate');
  }

  /**
   * Loads one non-deleted estate with its required location relations.
   * This is the canonical hydration path for every Estate response.
   */
  async findById(
    id: string,
    manager: EntityManager = this.repository.manager,
  ): Promise<Estate | null> {
    const query = manager
      .getRepository(Estate)
      .createQueryBuilder('estate')
      .innerJoinAndSelect('estate.province', 'province')
      .innerJoinAndSelect('estate.ward', 'ward')
      .where('estate.id = :id', { id })
      .andWhere('estate.deletedAt IS NULL');
    return query.getOne();
  }

  /** Loads only an active, non-deleted estate for public marketplace access. */
  async findPublicActiveById(id: string): Promise<Estate | null> {
    return this.repository
      .createQueryBuilder('estate')
      .innerJoinAndSelect('estate.province', 'province')
      .innerJoinAndSelect('estate.ward', 'ward')
      .where('estate.id = :id', { id })
      .andWhere('estate.status = :status', { status: EstateStatus.ACTIVE })
      .andWhere('estate.deletedAt IS NULL')
      .getOne();
  }

  /** Runs a callback while holding a pessimistic write lock on one estate row. */
  async withLockedEstate<T>(
    id: string,
    callback: (estate: Estate, manager: EntityManager) => Promise<T>,
  ): Promise<T | null> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      const estate = await queryRunner.manager
        .getRepository(Estate)
        .createQueryBuilder('estate')
        .innerJoinAndSelect('estate.province', 'province')
        .innerJoinAndSelect('estate.ward', 'ward')
        .where('estate.id = :id', { id })
        .andWhere('estate.deletedAt IS NULL')
        // The lifecycle lock must cover only the Estate row. The joined
        // Province/Ward rows are reference data and are not part of the
        // archive/delete/publish serialization boundary.
        .setLock('pessimistic_write', undefined, ['estate'])
        .getOne();
      if (!estate) {
        await queryRunner.commitTransaction();
        return null;
      }
      const result = await callback(estate, queryRunner.manager);
      await queryRunner.commitTransaction();
      return result;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /** Lists non-deleted estates owned by one exact provider identifier. */
  async findByProviderId(providerId: string): Promise<Estate[]> {
    return this.repository
      .createQueryBuilder('estate')
      .innerJoinAndSelect('estate.province', 'province')
      .innerJoinAndSelect('estate.ward', 'ward')
      .where('estate.providerId = :providerId', { providerId })
      .andWhere('estate.deletedAt IS NULL')
      .orderBy('estate.createdAt', 'DESC')
      .getMany();
  }

  /**
   * Persists a new estate with the caller-provided ownership fields, then
   * reloads it through the canonical hydration path so the caller always
   * receives the province/ward relations the response contract requires.
   */
  async createEstate(data: CreateEstateData): Promise<Estate> {
    const estate = this.repository.create({
      ...data,
      status: EstateStatus.DRAFT,
    });
    const saved = await this.repository.save(estate);
    return this.requireHydratedEstate(saved.id);
  }

  /**
   * Updates one exact estate and returns the refreshed entity reloaded
   * through the canonical hydration path, guaranteeing the province/ward
   * relations required by the response contract.
   */
  async updateEstate(
    id: string,
    data: UpdateEstateDto,
  ): Promise<Estate | null> {
    const {
      title,
      description,
      type,
      purpose,
      price,
      area,
      bedrooms,
      bathrooms,
      floors,
      addressLine,
      provinceId,
      wardId,
      latitude,
      longitude,
    } = data;
    const estate = await this.repository.preload({
      id,
      title,
      description,
      type,
      purpose,
      price,
      area,
      bedrooms,
      bathrooms,
      floors,
      addressLine,
      provinceId,
      wardId,
      latitude,
      longitude,
    });
    if (!estate) {
      return null;
    }
    await this.repository.save(estate);
    return this.requireHydratedEstate(id);
  }

  /**
   * Reloads a just-persisted estate through {@link findById}. The province
   * and ward relations are NOT NULL in the schema, so a missing row here can
   * only mean the row was removed concurrently — fail loudly instead of
   * returning a response that silently violates the wire contract.
   */
  private async requireHydratedEstate(id: string): Promise<Estate> {
    const hydrated = await this.findById(id);
    if (!hydrated) {
      throw new Error(
        `Estate ${id} disappeared after persistence; cannot hydrate the response contract.`,
      );
    }
    return hydrated;
  }
  /** Marks one exact estate deleted and reports whether a row changed. */
  async softDeleteEstate(
    id: string,
    manager: EntityManager = this.repository.manager,
  ): Promise<boolean> {
    const result = await manager
      .getRepository(Estate)
      .createQueryBuilder()
      .softDelete()
      .from(Estate)
      .where('id = :id AND deleted_at IS NULL', { id })
      .execute();

    return (result.affected ?? 0) > 0;
  }

  /**
   * Performs one optimistic lifecycle transition. The source status is part of
   * the WHERE clause, so competing commands cannot both succeed from it.
   * Archive additionally checks the listing invariant in the same statement.
   */
  async transitionStatus(
    id: string,
    providerId: string,
    from: EstateStatus,
    to: EstateStatus,
    manager: EntityManager = this.repository.manager,
  ): Promise<boolean> {
    const query = manager
      .getRepository(Estate)
      .createQueryBuilder()
      .update(Estate)
      .set({
        status: to,
      })
      .where('id = :id AND fk_provider_id = :providerId AND status = :from', {
        id,
        providerId,
        from,
      });
    query.andWhere('deleted_at IS NULL');

    if (to === EstateStatus.ARCHIVED) {
      query.andWhere(`NOT EXISTS (
        SELECT 1
        FROM tbl_listing listing
        WHERE listing.fk_estate_id = tbl_estate.id
          AND listing.status = 'PUBLISHED'
          AND listing.deleted_at IS NULL
      )`);
    }

    const result = await query.execute();
    return (result.affected ?? 0) > 0;
  }

  /** Prevents archiving a property while a published listing is public. */
  async hasPublishedListing(
    id: string,
    manager: EntityManager = this.repository.manager,
  ): Promise<boolean> {
    const result: unknown = await manager.query(
      `SELECT 1
       FROM tbl_listing
       WHERE fk_estate_id = $1
         AND status = 'PUBLISHED'
         AND deleted_at IS NULL
       LIMIT 1`,
      [id],
    );
    return Array.isArray(result) && result.length > 0;
  }
}
