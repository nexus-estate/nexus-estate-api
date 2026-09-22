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
import { EstateErrorCodes } from '../errors/estate-error-codes';
import { EstateActivationPolicy } from '../helpers/estate-activation.policy';
import { EstateStatus } from '../types/estate.type';

@Injectable()
export class EstateService {
  constructor(
    private readonly estateRepository: EstateRepo,
    private readonly provinceRepository: ProvinceRepo,
    private readonly wardRepository: WardRepository,
    private readonly providerContextResolver: ProviderContextResolver,
    private readonly supplyAccessPolicy: ProviderSupplyAccessPolicy,
  ) {}

  private readonly activationPolicy = new EstateActivationPolicy();

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

  /** Resolves the provider context and enforces provider lifecycle state. */
  private async requireSupplyWriteContext(
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
  async findPublicById(id: string): Promise<Estate> {
    const estate = await this.estateRepository.findPublicActiveById(id);
    if (!estate) {
      throw new BusinessException(CommonErrorCodes.RESOURCE_NOT_FOUND, id);
    }
    return estate;
  }

  /** Loads one provider-owned property through an explicit authorization path. */
  async findOwnedById(
    customerId: string,
    estateId: string,
    providerId?: string,
  ): Promise<Estate> {
    const context = await this.requireSupplyReadContext(customerId, providerId);
    await this.supplyAccessPolicy.requirePermission(context, 'property:read');
    return this.requireOwnedEstate(estateId, context);
  }

  /** Loads the provider-owned detail required by the property edit command. */
  async findOwnedByIdForUpdate(
    customerId: string,
    estateId: string,
    providerId?: string,
  ): Promise<Estate> {
    const context = await this.requireSupplyReadContext(customerId, providerId);
    await this.supplyAccessPolicy.requirePermission(context, 'property:update');
    return this.requireOwnedEstate(estateId, context);
  }

  /** Loads one estate owned by the exact provider context or raises not-found. */
  private async requireOwnedEstate(
    estateId: string,
    context: ProviderContext,
  ): Promise<Estate> {
    const estate = await this.estateRepository.findById(estateId);
    if (!estate) {
      throw new BusinessException(
        CommonErrorCodes.RESOURCE_NOT_FOUND,
        estateId,
      );
    }
    if (estate.providerId !== context.providerId) {
      throw new BusinessException(
        CommonErrorCodes.FORBIDDEN,
        context.providerId,
      );
    }
    return estate;
  }

  /** Creates an estate owned by the authenticated provider context. */
  async createEstate(
    customerId: string,
    dto: CreateEstateDto,
    providerId?: string,
  ): Promise<Estate> {
    const context = await this.requireSupplyWriteContext(
      customerId,
      providerId,
    );
    await this.supplyAccessPolicy.requirePermission(context, 'property:create');

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

  /** Updates an estate only after provider ownership and supply policy checks. */
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
    await this.supplyAccessPolicy.requirePermission(context, 'property:update');
    const estate = await this.requireOwnedEstate(estateId, context);
    const checkedLocation = await this.validateLocation(
      dto.wardId ?? estate.wardId,
      dto.provinceId ?? estate.provinceId,
    );
    if (!checkedLocation) {
      throw new BusinessException(CommonErrorCodes.RESOURCE_NOT_FOUND);
    }
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
    return updatedEstate;
  }

  /** Activates a complete draft property using an optimistic state transition. */
  async activateEstate(
    customerId: string,
    estateId: string,
    providerId?: string,
  ): Promise<Estate> {
    const context = await this.requireSupplyWriteContext(
      customerId,
      providerId,
    );
    await this.supplyAccessPolicy.requirePermission(context, 'property:update');
    const estate = await this.requireOwnedEstate(estateId, context);
    this.assertTransition(estate.status, EstateStatus.ACTIVE);
    const missingFields = this.activationPolicy.missingFields(estate);
    if (missingFields.length > 0) {
      throw new BusinessException(
        EstateErrorCodes.PROPERTY_ACTIVATION_INCOMPLETE,
        missingFields.join(', '),
      );
    }
    return this.completeTransition(
      estate,
      context.providerId,
      EstateStatus.ACTIVE,
    );
  }

  /** Archives a draft or active property unless a published listing exists. */
  async archiveEstate(
    customerId: string,
    estateId: string,
    providerId?: string,
  ): Promise<Estate> {
    const context = await this.requireSupplyWriteContext(
      customerId,
      providerId,
    );
    await this.supplyAccessPolicy.requirePermission(
      context,
      'property:archive',
    );
    const transitioned = await this.estateRepository.withLockedEstate(
      estateId,
      async (estate, manager) => {
        if (estate.providerId !== context.providerId) {
          throw new BusinessException(
            CommonErrorCodes.FORBIDDEN,
            context.providerId,
          );
        }
        this.assertTransition(estate.status, EstateStatus.ARCHIVED);
        if (
          await this.estateRepository.hasPublishedListing(estate.id, manager)
        ) {
          throw new BusinessException(
            EstateErrorCodes.PROPERTY_PUBLISHED_LISTING_CONFLICT,
            estate.id,
          );
        }
        const changed = await this.estateRepository.transitionStatus(
          estate.id,
          context.providerId,
          estate.status,
          EstateStatus.ARCHIVED,
          manager,
        );
        if (!changed) {
          throw new BusinessException(CommonErrorCodes.DATABASE_ERROR);
        }
        const updated = await this.estateRepository.findById(
          estate.id,
          manager,
        );
        if (!updated) {
          throw new BusinessException(CommonErrorCodes.DATABASE_ERROR);
        }
        return updated;
      },
    );
    if (!transitioned) {
      throw new BusinessException(
        CommonErrorCodes.RESOURCE_NOT_FOUND,
        estateId,
      );
    }
    return transitioned;
  }

  /** Restores an archived property to draft; it never restores directly to active. */
  async restoreEstate(
    customerId: string,
    estateId: string,
    providerId?: string,
  ): Promise<Estate> {
    const context = await this.requireSupplyWriteContext(
      customerId,
      providerId,
    );
    await this.supplyAccessPolicy.requirePermission(context, 'property:update');
    const estate = await this.requireOwnedEstate(estateId, context);
    this.assertTransition(estate.status, EstateStatus.DRAFT);
    return this.completeTransition(
      estate,
      context.providerId,
      EstateStatus.DRAFT,
    );
  }

  private assertTransition(current: EstateStatus, target: EstateStatus): void {
    const valid =
      (current === EstateStatus.DRAFT &&
        (target === EstateStatus.ACTIVE || target === EstateStatus.ARCHIVED)) ||
      (current === EstateStatus.ACTIVE && target === EstateStatus.ARCHIVED) ||
      (current === EstateStatus.ARCHIVED && target === EstateStatus.DRAFT);
    if (!valid) {
      throw new BusinessException(
        EstateErrorCodes.PROPERTY_INVALID_STATUS_TRANSITION,
        current,
        target,
      );
    }
  }

  private async completeTransition(
    estate: Estate,
    providerId: string,
    target: EstateStatus,
  ): Promise<Estate> {
    const changed = await this.estateRepository.transitionStatus(
      estate.id,
      providerId,
      estate.status,
      target,
    );
    if (changed) {
      const transitioned = await this.estateRepository.findById(estate.id);
      if (transitioned) return transitioned;
    }

    // Re-read after a lost compare-and-set to expose a stable transition error
    // rather than allowing two commands to report success.
    const current = await this.estateRepository.findById(estate.id);
    if (current && current.providerId === providerId) {
      this.assertTransition(current.status, target);
    }
    if (
      target === EstateStatus.ARCHIVED &&
      (await this.estateRepository.hasPublishedListing(estate.id))
    ) {
      throw new BusinessException(
        EstateErrorCodes.PROPERTY_PUBLISHED_LISTING_CONFLICT,
        estate.id,
      );
    }
    throw new BusinessException(CommonErrorCodes.DATABASE_ERROR);
  }

  /** Legacy DELETE behavior retained separately from lifecycle archive commands. */
  async softDeleteEstate(
    customerId: string,
    estateId: string,
    providerId?: string,
  ): Promise<boolean> {
    const context = await this.requireSupplyWriteContext(
      customerId,
      providerId,
    );
    await this.supplyAccessPolicy.requirePermission(
      context,
      'property:archive',
    );
    const deleted = await this.estateRepository.withLockedEstate(
      estateId,
      async (estate, manager) => {
        if (estate.providerId !== context.providerId) {
          throw new BusinessException(
            CommonErrorCodes.FORBIDDEN,
            context.providerId,
          );
        }
        if (
          await this.estateRepository.hasPublishedListing(estate.id, manager)
        ) {
          throw new BusinessException(
            CommonErrorCodes.RESOURCE_CONFLICT,
            estate.id,
          );
        }
        const changed = await this.estateRepository.softDeleteEstate(
          estate.id,
          manager,
        );
        if (!changed) {
          throw new BusinessException(CommonErrorCodes.DATABASE_ERROR);
        }
        return true;
      },
    );
    if (!deleted) {
      throw new BusinessException(
        CommonErrorCodes.RESOURCE_NOT_FOUND,
        estateId,
      );
    }
    return deleted;
  }

  /** Lists estates belonging to the resolved provider context. */
  async listMine(customerId: string, providerId?: string): Promise<Estate[]> {
    const context = await this.requireSupplyReadContext(customerId, providerId);
    await this.supplyAccessPolicy.requirePermission(context, 'property:read');
    return this.estateRepository.findByProviderId(context.providerId);
  }
}
