import { Injectable } from '@nestjs/common';
import { ProvinceRepo } from '../repositories/province.repo';
import { wardRepository } from '../repositories/ward.repo';
import {
  Province,
  Ward,
} from '../../../../modules/location/entities/location.entity';

@Injectable()
export class locationService {
  constructor(
    private readonly provinceRepository: ProvinceRepo,
    private readonly wardRepository: wardRepository,
  ) {}

  async getAllProvinces(): Promise<Province[]> {
    return this.provinceRepository.findAll();
  }

  async getWardsByProvinceId(provinceId: string): Promise<Ward[]> {
    return this.wardRepository.findByProvinceId(provinceId);
  }
}
