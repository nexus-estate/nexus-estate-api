import { Injectable } from '@nestjs/common';
import { ProvinceRepo } from '../repositories/province.repo';
import { WardRepository } from '../repositories/ward.repo';
import {
  Province,
  Ward,
} from '../../../../modules/location/administrative-division/entities/location.entity';

@Injectable()
export class locationService {
  constructor(
    private readonly provinceRepository: ProvinceRepo,
    private readonly wardRepository: WardRepository,
  ) {}

  async getAllProvinces(): Promise<Province[]> {
    return this.provinceRepository.findAll();
  }

  async getWardsByProvinceId(provinceId: string): Promise<Ward[]> {
    return this.wardRepository.findByProvinceId(provinceId);
  }
}
