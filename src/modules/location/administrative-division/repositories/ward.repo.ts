import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Ward } from '../entities/location.entity';

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

  async findByProvinceId(provinceId: string): Promise<Ward[]> {
    return this.repository
      .createQueryBuilder('w')
      .where('w.provinceId = :provinceId', { provinceId })
      .orderBy('w.name', 'ASC')
      .getMany();
  }
}
