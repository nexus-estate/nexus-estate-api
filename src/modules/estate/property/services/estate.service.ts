import { Injectable } from '@nestjs/common';
import { EstateRepo } from '../repositories/estate.repo';
import { Estate } from '../entities';
import { BusinessException } from '../../../../common/exceptions/business.exception';
import { CommonErrorCodes } from '../../../../common/errors/common-error-codes';
import { CreateEstateDto } from '../dto/create-estate-dto';
import { ProvinceRepo } from '../../../location/administrative-division/repositories/province.repo';
import { WardRepository } from '../../../location/administrative-division/repositories/ward.repo';
import { UpdateEstateDto } from '../dto/update-estate-dto';
import {
  ProviderContextResolver,
  type ProviderContext,
} from '../../../provider/account/services/provider-context.resolver';
import { ProviderSupplyAccessPolicy } from '../../../provider/authorization/helpers/provider-supply-access.policy';

@Injectable()
export class EstateService {
  constructor(
    private readonly estateRepository: EstateRepo,
    private readonly provinceRepository: ProvinceRepo,
    private readonly wardRepository: WardRepository,
    private readonly providerContextResolver: ProviderContextResolver,
    private readonly supplyAccessPolicy: ProviderSupplyAccessPolicy,
  ) {}

  /** Resolves the provider context and enforces supply read access. */
  private async requireSupplyReadContext(
    customerId: string,
    providerId?: string,
  ): Promise<ProviderContext> {
    const context = await this.providerContextResolver.resolve(
      customerId,
      providerId,
    );
    this.supplyAccessPolicy.requireReadAccess(context);
    return context;
  }

  /** Resolves the provider context and enforces supply write access. */
  private async requireSupplyWriteContext(
    customerId: string,
    providerId?: string,
  ): Promise<ProviderContext> {
    const context = await this.providerContextResolver.resolve(
      customerId,
      providerId,
    );
    await this.supplyAccessPolicy.requireWriteAccess(context);
    return context;
  }

  private async validateLocation(
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

  /** Loads one estate by exact identifier or raises the feature's not-found error. */
  async findById(id: string): Promise<Estate> {
    const estate = await this.estateRepository.findById(id);
    if (!estate) {
      throw new BusinessException(CommonErrorCodes.RESOURCE_NOT_FOUND, id);
    }
    return estate;
  }
  /** Creates an estate owned by the authenticated provider/customer context. */
  async createEstate(
    customerId: string,
    dto: CreateEstateDto,
    providerId?: string,
  ): Promise<Estate> {
    const context = await this.requireSupplyWriteContext(
      customerId,
      providerId,
    );

    // 1. find province
    const checkedLocation = await this.validateLocation(
      dto.wardId,
      dto.provinceId,
    );
    if (!checkedLocation) {
      throw new BusinessException(CommonErrorCodes.RESOURCE_NOT_FOUND);
    }
    return await this.estateRepository.createEstate({
      ...dto,
      customerId,
      providerId: context.providerId,
    });
  }

  /** Updates an estate only after ownership and active-provider policy checks. */
  async updateEstate(
    dto: UpdateEstateDto,
    customerId: string,
    estateId: string,
    providerId?: string,
  ): Promise<Estate> {
    const context = await this.requireSupplyWriteContext(
      customerId,
      providerId,
    );
    const estate = await this.estateRepository.findById(estateId);
    if (!estate) {
      throw new BusinessException(
        CommonErrorCodes.RESOURCE_NOT_FOUND,
        estateId,
      );
    }
    if (estate.providerId && estate.providerId !== context.providerId) {
      throw new BusinessException(
        CommonErrorCodes.FORBIDDEN,
        context.providerId,
      );
    }
    const checkedLocation = await this.validateLocation(
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

  /** Soft-deletes an estate after enforcing the same ownership boundary as update. */
  async softDeleteEstate(
    customerId: string,
    estateId: string,
    providerId?: string,
  ): Promise<boolean> {
    const context = await this.requireSupplyWriteContext(
      customerId,
      providerId,
    );
    const estate = await this.estateRepository.findById(estateId);
    if (!estate) {
      throw new BusinessException(
        CommonErrorCodes.RESOURCE_NOT_FOUND,
        estateId,
      );
    }
    if (
      customerId !== estate.customerId ||
      (estate.providerId && estate.providerId !== context.providerId)
    ) {
      throw new BusinessException(CommonErrorCodes.FORBIDDEN, customerId);
    }
    const deletedEstate =
      await this.estateRepository.softDeleteEstate(estateId);

    if (!deletedEstate) {
      throw new BusinessException(CommonErrorCodes.DATABASE_ERROR);
    }
    return true;
  }

  /** Lists estates belonging to one exact customer/provider owner. */
  async findByCustomerId(
    customerId: string,
    providerId?: string,
  ): Promise<Estate[]> {
    const context = await this.requireSupplyReadContext(customerId, providerId);
    return this.estateRepository.findByCustomerId(
      customerId,
      context.providerId,
    );
  }
}
