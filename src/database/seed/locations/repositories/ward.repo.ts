import { Repository } from 'typeorm';
import { Ward } from '../../../../modules/location/entities/location.entity';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';

@Injectable()
export class wardRepository {
  constructor(
    @InjectRepository(Ward)
    private readonly repository: Repository<Ward>,
  ) {}

  async findByProvinceId(provinceId: string): Promise<Ward[]> {
    return this.repository.find({
      where: { provinceId },
      order: {
        name: 'ASC',
      },
    });
  }
  /*
  Slect *
  From tbl_ward
  Where fk_province === "..."
  Order By name ASC
   */

  async findByCode(code: string): Promise<Ward | null> {
    return this.repository.findOne({
      where: {
        code,
      },
    });
  }
}
