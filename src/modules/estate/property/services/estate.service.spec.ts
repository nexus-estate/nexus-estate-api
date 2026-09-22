import { CommonErrorCodes } from '../../../../common/errors/common-error-codes';
import { BusinessException } from '../../../../common/exceptions/business.exception';
import { ProvinceRepo } from '../../../location/administrative-division/repositories/province.repo';
import { WardRepository } from '../../../location/administrative-division/repositories/ward.repo';
import {
  Province,
  Ward,
} from '../../../location/administrative-division/entities/location.entity';
import { CreateEstateDto } from '../dto/create-estate-dto';
import { UpdateEstateDto } from '../dto/update-estate-dto';
import { Estate } from '../entities';
import { EstateRepo } from '../repositories/estate.repo';
import { EstatePurpose, EstateType } from '../types/estate.type';
import { EstateStatus } from '../types/estate.type';
import { EstateErrorCodes } from '../errors/estate-error-codes';
import { EstateService } from './estate.service';
import {
  ProviderContextResolver,
  type ProviderContext,
} from '../../../provider/account/services/provider-context.resolver';
import { ProviderSupplyAccessPolicy } from '../../../provider/authorization/helpers/provider-supply-access.policy';
import {
  ProviderStatus,
  ProviderType,
  ProviderVerificationStatus,
} from '../../../provider/account/enums/account.enums';
import { ProviderAccountErrorCodes } from '../../../provider/account/errors/provider-account-error-codes';
import type { EntityManager } from 'typeorm';

type EstateRepoMock = {
  findById: jest.MockedFunction<EstateRepo['findById']>;
  findPublicActiveById: jest.MockedFunction<EstateRepo['findPublicActiveById']>;
  findByProviderId: jest.MockedFunction<EstateRepo['findByProviderId']>;
  createEstate: jest.MockedFunction<EstateRepo['createEstate']>;
  updateEstate: jest.MockedFunction<EstateRepo['updateEstate']>;
  softDeleteEstate: jest.MockedFunction<EstateRepo['softDeleteEstate']>;
  hasPublishedListing: jest.MockedFunction<EstateRepo['hasPublishedListing']>;
  transitionStatus: jest.MockedFunction<EstateRepo['transitionStatus']>;
  withLockedEstate: jest.MockedFunction<EstateRepo['withLockedEstate']>;
};

type ProvinceRepoMock = {
  findById: jest.MockedFunction<ProvinceRepo['findById']>;
};

type WardRepositoryMock = {
  findById: jest.MockedFunction<WardRepository['findById']>;
};

type ProviderContextResolverMock = {
  resolve: jest.MockedFunction<ProviderContextResolver['resolve']>;
};

type ProviderSupplyAccessPolicyMock = {
  requireReadAccess: jest.MockedFunction<
    ProviderSupplyAccessPolicy['requireReadAccess']
  >;
  requirePermission: jest.MockedFunction<
    ProviderSupplyAccessPolicy['requirePermission']
  >;
};

describe('EstateService', () => {
  let service: EstateService;
  let estateRepository: EstateRepoMock;
  let provinceRepository: ProvinceRepoMock;
  let wardRepository: WardRepositoryMock;
  let providerContextResolver: ProviderContextResolverMock;
  let supplyAccessPolicy: ProviderSupplyAccessPolicyMock;

  const customerId = '10000000-0000-4000-8000-000000000001';
  const otherCustomerId = '10000000-0000-4000-8000-000000000002';
  const estateId = '20000000-0000-4000-8000-000000000001';
  const providerId = '20000000-0000-4000-8000-000000000002';
  const otherProviderId = '20000000-0000-4000-8000-000000000003';
  const provinceId = '30000000-0000-4000-8000-000000000001';
  const wardId = '40000000-0000-4000-8000-000000000001';
  const newProvinceId = '30000000-0000-4000-8000-000000000002';
  const newWardId = '40000000-0000-4000-8000-000000000002';

  const province = { id: provinceId } as Province;
  const ward = { id: wardId, provinceId } as Ward;
  const newProvince = { id: newProvinceId } as Province;
  const newWard = { id: newWardId, provinceId: newProvinceId } as Ward;

  const createDto: CreateEstateDto = {
    title: 'Riverside apartment',
    type: EstateType.APARTMENT,
    purpose: EstatePurpose.SALE,
    price: 3_500_000_000,
    addressLine: '1 Nguyen Hue',
    provinceId,
    wardId,
  };

  const estate = {
    id: estateId,
    customerId,
    providerId,
    title: createDto.title,
    type: createDto.type,
    purpose: createDto.purpose,
    price: createDto.price,
    addressLine: createDto.addressLine,
    provinceId,
    wardId,
    status: EstateStatus.DRAFT,
  } as Estate;

  beforeEach(() => {
    estateRepository = {
      findById: jest.fn(),
      findPublicActiveById: jest.fn(),
      findByProviderId: jest.fn(),
      createEstate: jest.fn(),
      updateEstate: jest.fn(),
      softDeleteEstate: jest.fn(),
      hasPublishedListing: jest.fn().mockResolvedValue(false),
      transitionStatus: jest.fn(),
      withLockedEstate: jest.fn(),
    };
    estateRepository.withLockedEstate.mockImplementation(
      async (id, callback) => {
        const locked = await estateRepository.findById(id);
        if (!locked) return null;
        return callback(locked, {} as EntityManager);
      },
    );
    provinceRepository = { findById: jest.fn() };
    wardRepository = { findById: jest.fn() };
    const context: ProviderContext = {
      customerId,
      providerId,
      providerType: ProviderType.INDIVIDUAL,
      providerStatus: ProviderStatus.ACTIVE,
      verificationStatus: ProviderVerificationStatus.VERIFIED,
      providerDisplayName: 'Provider',
      membershipId: '30000000-0000-4000-8000-000000000099',
      membershipStatus: 'ACTIVE',
    };
    providerContextResolver = {
      resolve: jest.fn().mockResolvedValue(context),
    };
    supplyAccessPolicy = {
      requireReadAccess: jest.fn(),
      requirePermission: jest.fn().mockResolvedValue(undefined),
    };

    service = new EstateService(
      estateRepository as unknown as EstateRepo,
      provinceRepository as unknown as ProvinceRepo,
      wardRepository as unknown as WardRepository,
      providerContextResolver as unknown as ProviderContextResolver,
      supplyAccessPolicy as unknown as ProviderSupplyAccessPolicy,
    );
  });

  describe('createEstate', () => {
    it('validates the location and stores the current provider id', async () => {
      provinceRepository.findById.mockResolvedValue(province);
      wardRepository.findById.mockResolvedValue(ward);
      estateRepository.createEstate.mockResolvedValue(estate);

      await expect(service.createEstate(customerId, createDto)).resolves.toBe(
        estate,
      );
      expect(provinceRepository.findById).toHaveBeenCalledWith(provinceId);
      expect(wardRepository.findById).toHaveBeenCalledWith(wardId);
      expect(providerContextResolver.resolve).toHaveBeenCalledWith(
        customerId,
        undefined,
      );
      expect(supplyAccessPolicy.requirePermission).toHaveBeenCalledWith(
        expect.objectContaining({ customerId, providerId }),
        'property:create',
      );
      expect(estateRepository.createEstate).toHaveBeenCalledWith({
        ...createDto,
        customerId,
        providerId,
      });
    });

    it('throws RESOURCE_NOT_FOUND when the province does not exist', async () => {
      provinceRepository.findById.mockResolvedValue(null);

      await expect(
        service.createEstate(customerId, createDto),
      ).rejects.toMatchObject({
        errorCode: CommonErrorCodes.RESOURCE_NOT_FOUND.code,
      });
      expect(wardRepository.findById).not.toHaveBeenCalled();
      expect(estateRepository.createEstate).not.toHaveBeenCalled();
    });

    it('throws RESOURCE_NOT_FOUND when the ward does not exist', async () => {
      provinceRepository.findById.mockResolvedValue(province);
      wardRepository.findById.mockResolvedValue(null);

      await expect(
        service.createEstate(customerId, createDto),
      ).rejects.toMatchObject({
        errorCode: CommonErrorCodes.RESOURCE_NOT_FOUND.code,
      });
      expect(estateRepository.createEstate).not.toHaveBeenCalled();
    });

    it('throws VALIDATION_ERROR when the ward belongs to another province', async () => {
      provinceRepository.findById.mockResolvedValue(province);
      wardRepository.findById.mockResolvedValue({
        ...ward,
        provinceId: newProvinceId,
      });

      await expect(
        service.createEstate(customerId, createDto),
      ).rejects.toMatchObject({
        errorCode: CommonErrorCodes.VALIDATION_ERROR.code,
      });
      expect(estateRepository.createEstate).not.toHaveBeenCalled();
    });
  });

  describe('findPublicById', () => {
    it('returns an estate from the repository', async () => {
      estateRepository.findPublicActiveById.mockResolvedValue(estate);

      await expect(service.findPublicById(estateId)).resolves.toBe(estate);
      expect(estateRepository.findPublicActiveById).toHaveBeenCalledWith(
        estateId,
      );
    });

    it('throws RESOURCE_NOT_FOUND when the estate does not exist', async () => {
      estateRepository.findPublicActiveById.mockResolvedValue(null);

      await expect(service.findPublicById(estateId)).rejects.toMatchObject({
        errorCode: CommonErrorCodes.RESOURCE_NOT_FOUND.code,
      });
    });
  });

  it('authorizes an owned lookup through the resolved provider context', async () => {
    estateRepository.findById.mockResolvedValue(estate);

    await expect(service.findOwnedById(customerId, estateId)).resolves.toBe(
      estate,
    );
    expect(supplyAccessPolicy.requirePermission).toHaveBeenCalledWith(
      expect.objectContaining({ providerId }),
      'property:read',
    );
  });

  it('rejects an owned lookup across providers', async () => {
    estateRepository.findById.mockResolvedValue({
      ...estate,
      providerId: otherProviderId,
    });

    await expect(
      service.findOwnedById(customerId, estateId),
    ).rejects.toMatchObject({
      errorCode: CommonErrorCodes.FORBIDDEN.code,
    });
  });

  it('uses property:update for the provider-owned edit detail contract', async () => {
    estateRepository.findById.mockResolvedValue(estate);

    await expect(
      service.findOwnedByIdForUpdate(customerId, estateId),
    ).resolves.toBe(estate);
    expect(supplyAccessPolicy.requirePermission).toHaveBeenCalledWith(
      expect.objectContaining({ providerId }),
      'property:update',
    );
  });

  it('blocks estate creation when the provider is not active and verified', async () => {
    supplyAccessPolicy.requirePermission.mockRejectedValue(
      new BusinessException(
        ProviderAccountErrorCodes.PROVIDER_ACCOUNT_NOT_VERIFIED,
      ),
    );

    await expect(
      service.createEstate(customerId, createDto),
    ).rejects.toMatchObject({
      errorCode: ProviderAccountErrorCodes.PROVIDER_ACCOUNT_NOT_VERIFIED.code,
    });
    expect(provinceRepository.findById).not.toHaveBeenCalled();
    expect(estateRepository.createEstate).not.toHaveBeenCalled();
  });

  describe('listMine', () => {
    it('queries the repository by the resolved provider only', async () => {
      estateRepository.findByProviderId.mockResolvedValue([estate]);

      await expect(service.listMine(customerId)).resolves.toEqual([estate]);
      expect(providerContextResolver.resolve).toHaveBeenCalledWith(
        customerId,
        undefined,
      );
      expect(estateRepository.findByProviderId).toHaveBeenCalledWith(
        providerId,
      );
    });

    it('returns an empty array without throwing', async () => {
      estateRepository.findByProviderId.mockResolvedValue([]);

      await expect(service.listMine(customerId)).resolves.toEqual([]);
    });
  });

  describe('updateEstate', () => {
    it('throws RESOURCE_NOT_FOUND when the estate does not exist', async () => {
      estateRepository.findById.mockResolvedValue(null);

      await expect(
        service.updateEstate({ title: 'Updated' }, customerId, estateId),
      ).rejects.toMatchObject({
        errorCode: CommonErrorCodes.RESOURCE_NOT_FOUND.code,
      });
      expect(estateRepository.updateEstate).not.toHaveBeenCalled();
    });

    it('allows a member of the same provider to update regardless of legacy customer owner', async () => {
      const memberEstate = {
        ...estate,
        customerId: otherCustomerId,
      };
      estateRepository.findById.mockResolvedValue(memberEstate);
      provinceRepository.findById.mockResolvedValue(province);
      wardRepository.findById.mockResolvedValue(ward);
      estateRepository.updateEstate.mockResolvedValue({
        ...memberEstate,
        title: 'Updated',
      });

      await expect(
        service.updateEstate({ title: 'Updated' }, customerId, estateId),
      ).resolves.toMatchObject({ title: 'Updated' });
      expect(estateRepository.updateEstate).toHaveBeenCalledWith(
        estateId,
        expect.anything(),
      );
    });

    it('throws FORBIDDEN for another provider without updating', async () => {
      estateRepository.findById.mockResolvedValue({
        ...estate,
        providerId: otherProviderId,
      });

      await expect(
        service.updateEstate({ title: 'Updated' }, customerId, estateId),
      ).rejects.toMatchObject({
        errorCode: CommonErrorCodes.FORBIDDEN.code,
      });
      expect(estateRepository.updateEstate).not.toHaveBeenCalled();
    });

    it('validates and updates using the effective province and ward', async () => {
      const dto: UpdateEstateDto = {
        provinceId: newProvinceId,
        wardId: newWardId,
      };
      estateRepository.findById.mockResolvedValue(estate);
      provinceRepository.findById.mockResolvedValue(newProvince);
      wardRepository.findById.mockResolvedValue(newWard);
      estateRepository.updateEstate.mockResolvedValue({
        ...estate,
        ...dto,
      });

      await service.updateEstate(dto, customerId, estateId);

      expect(provinceRepository.findById).toHaveBeenCalledWith(newProvinceId);
      expect(wardRepository.findById).toHaveBeenCalledWith(newWardId);
      expect(estateRepository.updateEstate).toHaveBeenCalledWith(estateId, dto);
    });

    it('combines a changed ward with the existing province for validation', async () => {
      const dto: UpdateEstateDto = { wardId: newWardId };
      estateRepository.findById.mockResolvedValue(estate);
      provinceRepository.findById.mockResolvedValue(province);
      wardRepository.findById.mockResolvedValue({
        ...newWard,
        provinceId,
      });
      estateRepository.updateEstate.mockResolvedValue({
        ...estate,
        ...dto,
      });

      await service.updateEstate(dto, customerId, estateId);

      expect(provinceRepository.findById).toHaveBeenCalledWith(provinceId);
      expect(wardRepository.findById).toHaveBeenCalledWith(newWardId);
    });

    it('rejects an effective ward that does not belong to the effective province', async () => {
      const dto: UpdateEstateDto = { provinceId: newProvinceId };
      estateRepository.findById.mockResolvedValue(estate);
      provinceRepository.findById.mockResolvedValue(newProvince);
      wardRepository.findById.mockResolvedValue(ward);

      await expect(
        service.updateEstate(dto, customerId, estateId),
      ).rejects.toMatchObject({
        errorCode: CommonErrorCodes.VALIDATION_ERROR.code,
      });
      expect(estateRepository.updateEstate).not.toHaveBeenCalled();
    });

    it('throws RESOURCE_NOT_FOUND when the repository cannot preload the estate', async () => {
      const dto: UpdateEstateDto = { title: 'Updated' };
      estateRepository.findById.mockResolvedValue(estate);
      provinceRepository.findById.mockResolvedValue(province);
      wardRepository.findById.mockResolvedValue(ward);
      estateRepository.updateEstate.mockResolvedValue(null);

      await expect(
        service.updateEstate(dto, customerId, estateId),
      ).rejects.toMatchObject({
        errorCode: CommonErrorCodes.RESOURCE_NOT_FOUND.code,
      });
    });
  });

  describe('lifecycle commands', () => {
    const lifecycleEstate = {
      ...estate,
      status: EstateStatus.DRAFT,
    } as Estate;

    it.each([
      [EstateStatus.DRAFT, EstateStatus.ACTIVE, 'activateEstate'],
      [EstateStatus.DRAFT, EstateStatus.ARCHIVED, 'archiveEstate'],
      [EstateStatus.ACTIVE, EstateStatus.ARCHIVED, 'archiveEstate'],
      [EstateStatus.ARCHIVED, EstateStatus.DRAFT, 'restoreEstate'],
    ])(
      'allows %s -> %s through the command boundary',
      async (from, target, command) => {
        const source = { ...lifecycleEstate, status: from };
        const result = { ...source, status: target };
        estateRepository.transitionStatus.mockResolvedValue(true);
        if (command === 'archiveEstate') {
          estateRepository.findById.mockResolvedValueOnce(result);
          estateRepository.withLockedEstate.mockImplementation(
            async (_id, callback) => {
              const updated = await callback(source, {} as never);
              return updated ?? result;
            },
          );
        } else {
          estateRepository.findById
            .mockResolvedValueOnce(source)
            .mockResolvedValueOnce(result);
        }

        await expect(
          service[
            command as 'activateEstate' | 'archiveEstate' | 'restoreEstate'
          ](customerId, estateId),
        ).resolves.toMatchObject({ status: target });
        if (command === 'archiveEstate') {
          expect(estateRepository.transitionStatus).toHaveBeenCalledWith(
            estateId,
            providerId,
            from,
            target,
            expect.anything(),
          );
        } else {
          expect(estateRepository.transitionStatus).toHaveBeenCalledWith(
            estateId,
            providerId,
            from,
            target,
          );
        }
      },
    );

    it.each([
      [EstateStatus.ACTIVE, 'activateEstate', EstateStatus.ACTIVE],
      [EstateStatus.ARCHIVED, 'activateEstate', EstateStatus.ACTIVE],
    ])('rejects %s -> %s', async (from, command, target) => {
      estateRepository.findById.mockResolvedValue({
        ...lifecycleEstate,
        status: from,
      });

      await expect(
        service[command as 'activateEstate'](customerId, estateId),
      ).rejects.toMatchObject({
        errorCode: EstateErrorCodes.PROPERTY_INVALID_STATUS_TRANSITION.code,
      });
      expect(estateRepository.transitionStatus).not.toHaveBeenCalled();
      expect(target).toBe(EstateStatus.ACTIVE);
    });

    it('rejects activation when publication-quality data is incomplete', async () => {
      estateRepository.findById.mockResolvedValue({
        ...lifecycleEstate,
        title: '',
      });

      await expect(
        service.activateEstate(customerId, estateId),
      ).rejects.toMatchObject({
        errorCode: EstateErrorCodes.PROPERTY_ACTIVATION_INCOMPLETE.code,
      });
      expect(estateRepository.transitionStatus).not.toHaveBeenCalled();
    });

    it('rejects archive when a published listing exists', async () => {
      estateRepository.withLockedEstate.mockImplementation(
        async (_id, callback) => callback(lifecycleEstate, {} as never),
      );
      estateRepository.hasPublishedListing.mockResolvedValue(true);

      await expect(
        service.archiveEstate(customerId, estateId),
      ).rejects.toMatchObject({
        errorCode: EstateErrorCodes.PROPERTY_PUBLISHED_LISTING_CONFLICT.code,
      });
      expect(estateRepository.transitionStatus).not.toHaveBeenCalled();
    });

    it('does not restore a soft-deleted property', async () => {
      estateRepository.findById.mockResolvedValue(null);

      await expect(
        service.restoreEstate(customerId, estateId),
      ).rejects.toMatchObject({
        errorCode: CommonErrorCodes.RESOURCE_NOT_FOUND.code,
      });
      expect(estateRepository.transitionStatus).not.toHaveBeenCalled();
    });

    it('turns a lost compare-and-set into a stable invalid-transition error', async () => {
      estateRepository.findById
        .mockResolvedValueOnce(lifecycleEstate)
        .mockResolvedValueOnce({
          ...lifecycleEstate,
          status: EstateStatus.ACTIVE,
        });
      estateRepository.transitionStatus.mockResolvedValue(false);

      await expect(
        service.activateEstate(customerId, estateId),
      ).rejects.toMatchObject({
        errorCode: EstateErrorCodes.PROPERTY_INVALID_STATUS_TRANSITION.code,
      });
    });
  });

  describe('softDeleteEstate', () => {
    it('throws RESOURCE_NOT_FOUND when the estate does not exist', async () => {
      estateRepository.findById.mockResolvedValue(null);

      await expect(
        service.softDeleteEstate(customerId, estateId),
      ).rejects.toMatchObject({
        errorCode: CommonErrorCodes.RESOURCE_NOT_FOUND.code,
      });
      expect(estateRepository.softDeleteEstate).not.toHaveBeenCalled();
    });

    it('throws FORBIDDEN for another provider', async () => {
      estateRepository.findById.mockResolvedValue({
        ...estate,
        providerId: otherProviderId,
      });

      await expect(
        service.softDeleteEstate(customerId, estateId),
      ).rejects.toMatchObject({
        errorCode: CommonErrorCodes.FORBIDDEN.code,
      });
      expect(estateRepository.softDeleteEstate).not.toHaveBeenCalled();
    });

    it('throws DATABASE_ERROR when no row is soft-deleted', async () => {
      estateRepository.findById.mockResolvedValue(estate);
      estateRepository.softDeleteEstate.mockResolvedValue(false);

      await expect(
        service.softDeleteEstate(customerId, estateId),
      ).rejects.toMatchObject({
        errorCode: CommonErrorCodes.DATABASE_ERROR.code,
      });
    });

    it('returns true after soft-deleting the provider-owned estate', async () => {
      estateRepository.findById.mockResolvedValue(estate);
      estateRepository.softDeleteEstate.mockResolvedValue(true);

      await expect(
        service.softDeleteEstate(customerId, estateId),
      ).resolves.toBe(true);
      expect(estateRepository.softDeleteEstate).toHaveBeenCalledWith(
        estateId,
        expect.anything(),
      );
    });

    it('rejects archiving a property with a published listing', async () => {
      estateRepository.findById.mockResolvedValue(estate);
      estateRepository.hasPublishedListing.mockResolvedValue(true);

      await expect(
        service.softDeleteEstate(customerId, estateId),
      ).rejects.toMatchObject({
        errorCode: CommonErrorCodes.RESOURCE_CONFLICT.code,
      });
      expect(estateRepository.softDeleteEstate).not.toHaveBeenCalled();
      expect(estateRepository.transitionStatus).not.toHaveBeenCalled();
    });
  });
});
