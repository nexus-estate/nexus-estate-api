import { Injectable } from '@nestjs/common';
import { Repository, DataSource } from 'typeorm';
import { Promotion } from '../entities/promotion.entity';

@Injectable()
export class PromotionRepo {
  private readonly repository: Repository<Promotion>;
  constructor(datasource: DataSource) {
    this.repository = datasource.getRepository(Promotion);
  }
  async findById(promotionId: string): Promise<Promotion | null> {
    return this.repository
      .createQueryBuilder('promotion')
      .where('promotion.id = :promotionId', {
        promotionId,
      })
      .andWhere('promotion.deletedAt IS NULL')
      .getOne();
  }
}
