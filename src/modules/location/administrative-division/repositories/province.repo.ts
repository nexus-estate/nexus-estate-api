import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Province } from '../entities/location.entity';

/** Reads province reference rows for location queries. */
@Injectable()
export class ProvinceRepo {
  constructor(
    @InjectRepository(Province)
    private readonly repository: Repository<Province>,
  ) {}

  async findById(id: string): Promise<Province | null> {
    return this.repository
      .createQueryBuilder('province')
      .where('province.id = :id', { id })
      .getOne();
  }

  async findAll(): Promise<Province[]> {
    return this.repository.createQueryBuilder('province').getMany();
  }

  async findByCode(code: string): Promise<Province | null> {
    return this.repository
      .createQueryBuilder('province')
      .where('province.code = :code', { code })
      .getOne();
  }
}
