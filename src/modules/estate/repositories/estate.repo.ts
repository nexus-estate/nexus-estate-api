import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Estate } from '../entities';
import { CreateEstateData } from '../type/estate.type';
import { UpdateEstateDto } from '../dto/update-estate-dto';

@Injectable()
export class EstateRepo {
  constructor(
    @InjectRepository(Estate)
    private readonly repository: Repository<Estate>,
  ) {}

  async findById(id: string): Promise<Estate | null> {
    return this.repository
      .createQueryBuilder('estate')
      .innerJoinAndSelect('estate.user', 'user')
      .innerJoinAndSelect('estate.province', 'province')
      .innerJoinAndSelect('estate.ward', 'ward')
      .where('estate.id = :id', { id })
      .andWhere('estate.deletedAt IS NULL')
      .getOne();
  }

  async findByUserId(userId: string): Promise<Estate[]> {
    return this.repository
      .createQueryBuilder('estate')
      .innerJoinAndSelect('estate.user', 'user')
      .innerJoinAndSelect('estate.province', 'province')
      .innerJoinAndSelect('estate.ward', 'ward')
      .where('estate.userId = :userId', { userId })
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
