import { Repository, DataSource } from 'typeorm';
import { Injectable } from '@nestjs/common';
import { ListingPromotion } from '../entities/listingPromotion.entity';

@Injectable()
export class ListingPromotionRepo {
  private readonly repository: Repository<ListingPromotion>;
  constructor(dataSource: DataSource) {
    this.repository = dataSource.getRepository(ListingPromotion);
  }

  async findOverlappingByListingId(
    listingId: string,
    startAt: Date,
    endAt: Date,
  ): Promise<ListingPromotion | null> {
    return this.repository
      .createQueryBuilder('promotion')
      .where('promotion.listingId = :listingId', { listingId })
      .andWhere('promotion.deletedAt IS NULL')
      .andWhere('promotion.startAt < :endAt', { endAt })
      .andWhere('promotion.endAt > :startAt', { startAt })
      .getOne();
  }
  create(data: Partial<ListingPromotion>): ListingPromotion {
    return this.repository.create(data);
  }

  save(promotion: ListingPromotion): Promise<ListingPromotion> {
    return this.repository.save(promotion);
  }
}
