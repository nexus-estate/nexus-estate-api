import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Ward, type WardType } from '../entities/location.entity';

/** Reads ward reference rows scoped to a province. */
@Injectable()
export class WardRepository {
  constructor(
    @InjectRepository(Ward)
    private readonly repository: Repository<Ward>,
  ) {}

  async findById(id: string): Promise<Ward | null> {
    return this.repository
      .createQueryBuilder('w')
      .where('w.id = :id', { id })
      .getOne();
  }

  async findByCode(code: string): Promise<Ward | null> {
    return this.repository
      .createQueryBuilder('w')
      .where('w.code = :code', { code })
      .getOne();
  }

  async findByProvinceId(provinceId: string, type?: WardType): Promise<Ward[]> {
    const query = this.repository
      .createQueryBuilder('w')
      .where('w.provinceId = :provinceId', { provinceId });
    if (type) query.andWhere('w.type = :type', { type });
    return query.orderBy('w.name', 'ASC').addOrderBy('w.code', 'ASC').getMany();
  }
}
