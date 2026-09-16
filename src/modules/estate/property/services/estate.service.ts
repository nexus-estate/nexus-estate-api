import { Injectable } from '@nestjs/common';
import { BaseService } from '../../../../services/abstraction-services';
import { EstateRepo } from '../repositories/estate.repo';
import { Estate } from '../entities';
import { BusinessException } from '../../../../common/exceptions/business.exception';
import { CommonErrorCodes } from '../../../../common/errors/common-error-codes';
import { CreateEstateDto } from '../dto/create-estate-dto';
import { ProvinceRepo } from '../../../../database/seed/locations/repositories/province.repo';
import { WardRepository } from '../../../../database/seed/locations/repositories/ward.repo';
import { UpdateEstateDto } from '../dto/update-estate-dto';
import type { CreateEstateData } from '../types/estate.type';
import { ProviderAccountService } from '../../../provider/account/services/provider-account.service';
import { ProviderAuthorizationService } from '../../../provider/authorization/services/provider-authorization.service';

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
    private readonly providerAccountService: ProviderAccountService,
    private readonly providerAuthorizationService?: ProviderAuthorizationService,
  ) {
    super(estateRepository, 'Estate');
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
    const context = providerId
      ? await this.providerAccountService.requireActiveProvider(
          customerId,
          providerId,
        )
      : await this.providerAccountService.requireActiveProvider(customerId);
    await this.providerAuthorizationService?.requireLegacyEstateOwner(
      customerId,
      context.providerId,
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
    const context = providerId
      ? await this.providerAccountService.requireActiveProvider(
          customerId,
          providerId,
        )
      : await this.providerAccountService.requireActiveProvider(customerId);
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
    await this.providerAuthorizationService?.requireLegacyEstateOwner(
      customerId,
      context.providerId,
    );

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
    const context = providerId
      ? await this.providerAccountService.requireActiveProvider(
          customerId,
          providerId,
        )
      : await this.providerAccountService.requireActiveProvider(customerId);
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
    await this.providerAuthorizationService?.requireLegacyEstateOwner(
      customerId,
      context.providerId,
    );
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
    const context = providerId
      ? await this.providerAccountService.requireActiveProvider(
          customerId,
          providerId,
        )
      : await this.providerAccountService.requireActiveProvider(customerId);
    return this.estateRepository.findByCustomerId(
      customerId,
      context.providerId,
    );
  }
}
