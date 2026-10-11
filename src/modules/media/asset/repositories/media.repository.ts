import { Injectable } from '@nestjs/common';
import { Media, MediaType } from '../entities';
import { DataSource } from 'typeorm';
import type { EntityManager } from 'typeorm';
import { BaseRepository } from '../../../../services/abstraction-services';
import { Estate } from '../../../estate/property/entities';

@Injectable()
/** Owns media queries and serializes image ordering within each estate. */
export class MediaRepository extends BaseRepository<Media> {
  constructor(dataSource: DataSource) {
    super(dataSource, Media, 'Media');
  }

  /** Lists one estate's non-deleted media in display order. */
  async findByEstateId(estateId: string): Promise<Media[]> {
    return this.repository
      .createQueryBuilder('media')
      .where('media.estateId = :estateId', { estateId })
      .andWhere('media.deletedAt IS NULL')
      .orderBy('media.sortOrder', 'ASC')
      .addOrderBy('media.createdAt', 'ASC')
      .getMany();
  }

  /** Loads a non-deleted media row only within its owning estate. */
  async findByIdAndEstateId(
    mediaId: string,
    estateId: string,
  ): Promise<Media | null> {
    return this.repository
      .createQueryBuilder('media')
      .where('media.id = :mediaId', { mediaId })
      .andWhere('media.estateId = :estateId', { estateId })
      .andWhere('media.deletedAt IS NULL')
      .getOne();
  }

  /** Call within the estate write lock when allocating an order for insertion. */
  async getNextSortOrder(
    estateId: string,
    manager: EntityManager = this.repository.manager,
  ): Promise<number> {
    const result = await manager
      .getRepository(Media)
      .createQueryBuilder('media')
      .select('MAX(media.sortOrder)', 'maxSortOrder')
      .where('media.estateId = :estateId', { estateId })
      .andWhere('media.deletedAt IS NULL')
      .getRawOne<{ maxSortOrder: number | string | null }>();
    const maxSortOrder = result?.maxSortOrder;
    return maxSortOrder === null || maxSortOrder === undefined
      ? 0
      : Number(maxSortOrder) + 1;
  }

  /**
   * Giữ khóa Estate đến khi transaction commit để các upload không trùng order
   * và không chạy cùng lúc với xóa Estate. Quyền vẫn do EstateService kiểm tra.
   */
  async withEstateLock<T>(
    estateId: string,
    operation: (manager: EntityManager) => Promise<T>,
  ): Promise<T> {
    return this.transaction(async (manager) => {
      await manager
        .getRepository(Estate)
        .createQueryBuilder('estate')
        .where('estate.id = :estateId', { estateId })
        .andWhere('estate.deletedAt IS NULL')
        .setLock('pessimistic_write')
        .getOne();
      // EstateService sẽ xử lý not-found/ownership trong operation, sau khi có khóa.
      return operation(manager);
    });
  }

  /** Lưu ảnh với order đã được service cấp, dùng cùng transaction đang giữ khóa. */
  async createEstateImage(
    estateId: string,
    objectKey: string,
    customerId: string,
    sortOrder: number,
    manager: EntityManager,
  ): Promise<Media> {
    const repository = manager.getRepository(Media);
    return repository.save(
      repository.create({
        estateId,
        mediaUrl: objectKey,
        type: MediaType.IMAGE,
        sortOrder,
        createdBy: customerId,
      }),
    );
  }
}
