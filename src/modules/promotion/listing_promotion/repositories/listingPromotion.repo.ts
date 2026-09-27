import { Repository, DataSource } from 'typeorm';
import { Injectable } from '@nestjs/common';
import { ListingPromotion } from '../entities/listingPromotion.entity';

@Injectable()
export class ListingPromotionRepo {
  private readonly repository: Repository<ListingPromotion>;
  constructor(dataSource: DataSource) {
    this.repository = dataSource.getRepository(ListingPromotion);
  }

  async findOverlappingByListingAndPromotion(
    listingId: string,
    promotionId: string,
    startAt: Date,
    endAt: Date,
  ): Promise<ListingPromotion | null> {
    return this.repository
      .createQueryBuilder('listingPromotion')
      .where('listingPromotion.listingId = :listingId', { listingId })
      .andWhere('listingPromotion.promotionId = :promotionId', { promotionId })
      .andWhere('listingPromotion.deletedAt IS NULL')
      .andWhere('listingPromotion.startAt < :endAt', { endAt })
      .andWhere('listingPromotion.endAt > :startAt', { startAt })
      .getOne();
  }
  create(data: Partial<ListingPromotion>): ListingPromotion {
    return this.repository.create(data);
  }

  save(promotion: ListingPromotion): Promise<ListingPromotion> {
    return this.repository.save(promotion);
  }
}
