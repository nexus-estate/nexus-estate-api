import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
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
  async findById(id: string, includeDeleted = false): Promise<Estate | null> {
    const query = this.repository
      .createQueryBuilder('estate')
      .innerJoinAndSelect('estate.province', 'province')
      .innerJoinAndSelect('estate.ward', 'ward')
      .where('estate.id = :id', { id });
    if (!includeDeleted) {
      query.andWhere('estate.deletedAt IS NULL');
    } else {
      query.withDeleted();
    }
    return query.getOne();
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
  async softDeleteEstate(id: string): Promise<boolean> {
    const result = await this.repository
      .createQueryBuilder()
      .softDelete()
      .from(Estate)
      .where('id = :id', { id })
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
  ): Promise<boolean> {
    const query = this.repository
      .createQueryBuilder()
      .update(Estate)
      .set({
        status: to,
        ...(from === EstateStatus.ARCHIVED && to === EstateStatus.DRAFT
          ? { deletedAt: () => 'NULL' }
          : {}),
      })
      .where('id = :id AND fk_provider_id = :providerId AND status = :from', {
        id,
        providerId,
        from,
      });

    if (!(from === EstateStatus.ARCHIVED && to === EstateStatus.DRAFT)) {
      query.andWhere('deleted_at IS NULL');
    }

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
  async hasPublishedListing(id: string): Promise<boolean> {
    const result: unknown = await this.dataSource.query(
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
