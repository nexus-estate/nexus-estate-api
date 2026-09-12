import { CommonErrorCodes } from '../../../../common/errors/common-error-codes';
import { BusinessException } from '../../../../common/exceptions/business.exception';
import { ProvinceRepo } from '../../../../database/seed/locations/repositories/province.repo';
import { WardRepository } from '../../../../database/seed/locations/repositories/ward.repo';
import {
  Province,
  Ward,
} from '../../../location/administrative-division/entities/location.entity';
import { CreateEstateDto } from '../dto/create-estate-dto';
import { UpdateEstateDto } from '../dto/update-estate-dto';
import { Estate } from '../entities';
import { EstateRepo } from '../repositories/estate.repo';
import { EstatePurpose, EstateType } from '../types/estate.type';
import { EstateService } from './estate.service';
import { ProviderAccountService } from '../../../provider/account/services/provider-account.service';
import {
  ProviderStatus,
  ProviderType,
  ProviderVerificationStatus,
} from '../../../provider/account/enums/account.enums';
import { ProviderAccountErrorCodes } from '../../../provider/account/errors/provider-account-error-codes';

type EstateRepoMock = {
  findById: jest.MockedFunction<EstateRepo['findById']>;
  findByCustomerId: jest.MockedFunction<EstateRepo['findByCustomerId']>;
  createEstate: jest.MockedFunction<EstateRepo['createEstate']>;
  updateEstate: jest.MockedFunction<EstateRepo['updateEstate']>;
  softDeleteEstate: jest.MockedFunction<EstateRepo['softDeleteEstate']>;
};

type ProvinceRepoMock = {
  findById: jest.MockedFunction<ProvinceRepo['findById']>;
};

type WardRepositoryMock = {
  findById: jest.MockedFunction<WardRepository['findById']>;
};

type ProviderAccountServiceMock = {
  requireActiveProvider: jest.MockedFunction<
    ProviderAccountService['requireActiveProvider']
  >;
};

describe('EstateService', () => {
  let service: EstateService;
  let estateRepository: EstateRepoMock;
  let provinceRepository: ProvinceRepoMock;
  let wardRepository: WardRepositoryMock;
  let providerAccountService: ProviderAccountServiceMock;

  const customerId = '10000000-0000-4000-8000-000000000001';
  const otherUserId = '10000000-0000-4000-8000-000000000002';
  const estateId = '20000000-0000-4000-8000-000000000001';
  const providerId = '20000000-0000-4000-8000-000000000002';
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
    customerId: customerId,
    title: createDto.title,
    type: createDto.type,
    purpose: createDto.purpose,
    price: createDto.price,
    addressLine: createDto.addressLine,
    provinceId,
    wardId,
  } as Estate;

  beforeEach(() => {
    estateRepository = {
      findById: jest.fn(),
      findByCustomerId: jest.fn(),
      createEstate: jest.fn(),
      updateEstate: jest.fn(),
      softDeleteEstate: jest.fn(),
    };
    provinceRepository = { findById: jest.fn() };
    wardRepository = { findById: jest.fn() };
    providerAccountService = {
      requireActiveProvider: jest.fn().mockResolvedValue({
        customerId,
        providerId,
        providerType: ProviderType.INDIVIDUAL,
        providerStatus: ProviderStatus.ACTIVE,
        verificationStatus: ProviderVerificationStatus.VERIFIED,
      }),
    };

    service = new EstateService(
      estateRepository as unknown as EstateRepo,
      provinceRepository as unknown as ProvinceRepo,
      wardRepository as unknown as WardRepository,
      providerAccountService as unknown as ProviderAccountService,
    );
  });

  describe('createEstate', () => {
    it('validates the location and persists the authenticated user id', async () => {
      provinceRepository.findById.mockResolvedValue(province);
      wardRepository.findById.mockResolvedValue(ward);
      estateRepository.createEstate.mockResolvedValue(estate);

      await expect(service.createEstate(customerId, createDto)).resolves.toBe(
        estate,
      );
      expect(provinceRepository.findById).toHaveBeenCalledWith(provinceId);
      expect(wardRepository.findById).toHaveBeenCalledWith(wardId);
      expect(providerAccountService.requireActiveProvider).toHaveBeenCalledWith(
        customerId,
      );
      expect(estateRepository.createEstate).toHaveBeenCalledWith({
        ...createDto,
        customerId,
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

  describe('findById', () => {
    it('returns an estate from the repository', async () => {
      estateRepository.findById.mockResolvedValue(estate);

      await expect(service.findById(estateId)).resolves.toBe(estate);
      expect(estateRepository.findById).toHaveBeenCalledWith(estateId);
    });

    it('throws RESOURCE_NOT_FOUND when the estate does not exist', async () => {
      estateRepository.findById.mockResolvedValue(null);

      await expect(service.findById(estateId)).rejects.toMatchObject({
        errorCode: CommonErrorCodes.RESOURCE_NOT_FOUND.code,
      });
    });
  });

  it('blocks estate creation when the provider is not active and verified', async () => {
    providerAccountService.requireActiveProvider.mockRejectedValue(
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

  describe('findByCustomerId', () => {
    it('returns the repository results', async () => {
      estateRepository.findByCustomerId.mockResolvedValue([estate]);

      await expect(service.findByCustomerId(customerId)).resolves.toEqual([
        estate,
      ]);
      expect(estateRepository.findByCustomerId).toHaveBeenCalledWith(
        customerId,
      );
    });

    it('returns an empty array without throwing', async () => {
      estateRepository.findByCustomerId.mockResolvedValue([]);

      await expect(service.findByCustomerId(customerId)).resolves.toEqual([]);
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

    it('throws FORBIDDEN for a non-owner without updating', async () => {
      estateRepository.findById.mockResolvedValue(estate);
      provinceRepository.findById.mockResolvedValue(province);
      wardRepository.findById.mockResolvedValue(ward);

      await expect(
        service.updateEstate({ title: 'Updated' }, otherUserId, estateId),
      ).rejects.toMatchObject({ errorCode: CommonErrorCodes.FORBIDDEN.code });
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

    it('throws FORBIDDEN for a non-owner', async () => {
      estateRepository.findById.mockResolvedValue(estate);

      await expect(
        service.softDeleteEstate(otherUserId, estateId),
      ).rejects.toMatchObject({ errorCode: CommonErrorCodes.FORBIDDEN.code });
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

    it('returns true after soft-deleting the owner estate', async () => {
      estateRepository.findById.mockResolvedValue(estate);
      estateRepository.softDeleteEstate.mockResolvedValue(true);

      await expect(
        service.softDeleteEstate(customerId, estateId),
      ).resolves.toBe(true);
      expect(estateRepository.softDeleteEstate).toHaveBeenCalledWith(estateId);
    });
  });
});
