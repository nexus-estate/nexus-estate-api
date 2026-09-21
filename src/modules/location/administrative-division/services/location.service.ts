import { Injectable } from '@nestjs/common';

import { ProvinceRepo } from '../repositories/province.repo';
import { WardRepository } from '../repositories/ward.repo';
import { Province, Ward } from '../entities/location.entity';

/** Application service for administrative-division reference data. */
@Injectable()
export class LocationService {
  constructor(
    private readonly provinceRepository: ProvinceRepo,
    private readonly wardRepository: WardRepository,
  ) {}

  /** Returns all provinces in deterministic display order. */
  async getAllProvinces(): Promise<Province[]> {
    return this.provinceRepository.findAll();
  }

  /** Returns wards belonging to one exact province identifier. */
  async getWardsByProvinceId(provinceId: string): Promise<Ward[]> {
    return this.wardRepository.findByProvinceId(provinceId);
  }
}
