import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { BaseRepository } from '../../../../services/abstraction-services';
import { Estate } from '../entities';
import { CreateEstateData } from '../types/estate.type';
import { UpdateEstateDto } from '../dto/update-estate-dto';

@Injectable()
export class EstateRepo extends BaseRepository<Estate> {
  constructor(dataSource: DataSource) {
    super(dataSource, Estate, 'Estate');
  }

  async findById(id: string): Promise<Estate | null> {
    return this.repository
      .createQueryBuilder('estate')
      .innerJoinAndSelect('estate.customer', 'customer')
      .innerJoinAndSelect('estate.province', 'province')
      .innerJoinAndSelect('estate.ward', 'ward')
      .where('estate.id = :id', { id })
      .andWhere('estate.deletedAt IS NULL')
      .getOne();
  }

  async findByCustomerId(customerId: string): Promise<Estate[]> {
    return this.repository
      .createQueryBuilder('estate')
      .innerJoinAndSelect('estate.customer', 'customer')
      .innerJoinAndSelect('estate.province', 'province')
      .innerJoinAndSelect('estate.ward', 'ward')
      .where('estate.customerId = :customerId', { customerId })
      .andWhere('estate.deletedAt IS NULL')
      .getMany();
  }

  async createEstate(data: CreateEstateData): Promise<Estate> {
    const estate = this.repository.create(data);
    return this.repository.save(estate);
  }
  async updateEstate(
    id: string,
    data: UpdateEstateDto,
  ): Promise<Estate | null> {
    const estate = await this.repository.preload({ id, ...data });
    if (!estate) {
      return null;
    }
    return this.repository.save(estate);
  }
  async softDeleteEstate(id: string): Promise<boolean> {
    const result = await this.repository
      .createQueryBuilder()
      .softDelete()
      .from(Estate)
      .where('id = :id', { id })
      .execute();

    return (result.affected ?? 0) > 0;
  }
}
