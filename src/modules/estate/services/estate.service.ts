import { Injectable } from '@nestjs/common';
import { BaseService } from '../../../services/abstraction-services';
import { EstateRepo } from '../repositories/estate.repo';
import { Estate } from '../entities';
import { BusinessException } from '../../../common/exceptions/business.exception';
import { CommonErrorCodes } from '../../../common/errors/common-error-codes';
import { CreateEstateDto } from '../dto/create-estate-dto';
import { ProvinceRepo } from '../../../database/seed/locations/repositories/province.repo';
import { WardRepository } from '../../../database/seed/locations/repositories/ward.repo';
import { UpdateEstateDto } from '../dto/update-estate-dto';
import type { CreateEstateData } from '../type/estate.type';

@Injectable()
export class EstateService extends BaseService<
  Estate,
  CreateEstateData,
  UpdateEstateDto
> {
  constructor(
    private readonly estateRepository: EstateRepo,
    private readonly provinceRepository: ProvinceRepo,
    private readonly wardRepository: WardRepository,
  ) {
    super(estateRepository, 'Estate');
  }
  private async validateLocaion(
    wardId: string,
    provinceId: string,
  ): Promise<boolean> {
    const province = await this.provinceRepository.findById(provinceId);
    if (!province) {
      throw new BusinessException(
        CommonErrorCodes.RESOURCE_NOT_FOUND,
        provinceId,
      );
    }
    // 2. find ward
    const ward = await this.wardRepository.findById(wardId);

    if (!ward) {
      throw new BusinessException(CommonErrorCodes.RESOURCE_NOT_FOUND, wardId);
    }

    // 3. check ward thuộc province
    if (ward.provinceId !== province.id) {
      throw new BusinessException(
        CommonErrorCodes.VALIDATION_ERROR,
        'Ward does not belong to province',
      );
    }

    return true;
  }

  async findById(id: string): Promise<Estate> {
    const estate = await this.estateRepository.findById(id);
    if (!estate) {
      throw new BusinessException(CommonErrorCodes.RESOURCE_NOT_FOUND, id);
    }
    return estate;
  }
  async createEstate(
    customerId: string,
    dto: CreateEstateDto,
  ): Promise<Estate> {
    // 1. find province
    const checkedLocation = await this.validateLocaion(
      dto.wardId,
      dto.provinceId,
    );
    if (!checkedLocation) {
      throw new BusinessException(CommonErrorCodes.RESOURCE_NOT_FOUND);
    }
    return await this.estateRepository.createEstate({ ...dto, customerId });
  }

  async updateEstate(
    dto: UpdateEstateDto,
    customerId: string,
    estateId: string,
  ): Promise<Estate> {
    //check exist estate
    const estate = await this.estateRepository.findById(estateId);
    if (!estate) {
      throw new BusinessException(
        CommonErrorCodes.RESOURCE_NOT_FOUND,
        estateId,
      );
    }

    const checkedLocation = await this.validateLocaion(
      dto.wardId ?? estate.wardId,
      dto.provinceId ?? estate.provinceId,
    );
    if (!checkedLocation) {
      throw new BusinessException(CommonErrorCodes.RESOURCE_NOT_FOUND);
    }
    // 3. check owner:
    if (customerId !== estate.customerId) {
      throw new BusinessException(CommonErrorCodes.FORBIDDEN, customerId);
    }

    // 5. gọi repository.updateEstate(estateId, dto)
    const updatedEstate = await this.estateRepository.updateEstate(
      estateId,
      dto,
    );
    if (!updatedEstate) {
      throw new BusinessException(
        CommonErrorCodes.RESOURCE_NOT_FOUND,
        estateId,
      );
    }
    // 6. return Estate
    return updatedEstate;
  }

  async softDeleteEstate(
    customerId: string,
    estateId: string,
  ): Promise<boolean> {
    const estate = await this.estateRepository.findById(estateId);
    if (!estate) {
      throw new BusinessException(
        CommonErrorCodes.RESOURCE_NOT_FOUND,
        estateId,
      );
    }

    if (customerId !== estate.customerId) {
      throw new BusinessException(CommonErrorCodes.FORBIDDEN, customerId);
    }
    const deletedEstate =
      await this.estateRepository.softDeleteEstate(estateId);

    if (!deletedEstate) {
      throw new BusinessException(CommonErrorCodes.DATABASE_ERROR);
    }
    return true;
  }

  async findByCustomerId(customerId: string): Promise<Estate[]> {
    return this.estateRepository.findByCustomerId(customerId);
  }
}
