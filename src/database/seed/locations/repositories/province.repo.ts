import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Province } from '../../../../modules/location/entities/location.entity';
import { Repository } from 'typeorm';

@Injectable() // Khai bao 1 class duoc quan li voi nestJs , dung de inject vao cac class khasc
export class ProvinceRepo {
  constructor(
    @InjectRepository(Province)
    private readonly repository: Repository<Province>, // private is access modifier , bien chi duoc dung duy nhat ben trong Province repo
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
