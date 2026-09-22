import { CommonErrorCodes } from '../../../../common/errors/common-error-codes';
import { Estate } from '../../../estate/property/entities/estate.entity';
import { EstateRepo } from '../../../estate/property/repositories/estate.repo';
import { ProviderContextResolver } from '../../../provider/account/services/provider-context.resolver';
import { ProviderSupplyAccessPolicy } from '../../../provider/authorization/helpers/provider-supply-access.policy';
import {
  ProviderStatus,
  ProviderType,
  ProviderVerificationStatus,
} from '../../../provider/account/enums/account.enums';
import { CreateListingDto } from '../dto/create-listing.dto';
import { Listing, ListingStatus } from '../entities';
import { ListingRepo } from '../repositories/listing.repo';
import { ListingService } from './listing.service';
import { EstateStatus } from '../../../estate/property/types/estate.type';
import type { EntityManager } from 'typeorm';

describe('ListingService', () => {
  const customerId = '10000000-0000-4000-8000-000000000001';
  const providerId = '20000000-0000-4000-8000-000000000001';
  const otherProviderId = '20000000-0000-4000-8000-000000000002';
  const estateId = '30000000-0000-4000-8000-000000000001';
  const listingId = '40000000-0000-4000-8000-000000000001';
  const estateData = {
    id: estateId,
    customerId,
    providerId,
    title: 'Estate',
    description: null,
    type: 'APARTMENT',
    purpose: 'SALE',
    price: 100,
    area: null,
    bedrooms: null,
    bathrooms: null,
    floors: null,
    addressLine: 'Address',
    provinceId: '50000000-0000-4000-8000-000000000001',
    wardId: '60000000-0000-4000-8000-000000000001',
    latitude: null,
    longitude: null,
    status: EstateStatus.ACTIVE,
    province: { id: 'province', code: '79', name: 'HCMC' },
    ward: { id: 'ward', code: '1', name: 'Ward 1' },
  };
  const estate = estateData as unknown as Estate;

  const buildService = (estate: unknown) => {
    const listingRepository = {
      findById: jest.fn(),
      findByEstateId: jest.fn().mockResolvedValue(null),
      findEligibleForListing: jest.fn().mockResolvedValue([]),
      create: jest.fn(
        (data: Partial<Listing>) =>
          ({
            id: listingId,
            createdAt: new Date(),
            updatedAt: new Date(),
            ...data,
          }) as Listing,
      ),
      save: jest.fn((listing: Listing) => Promise.resolve(listing)),
    } as unknown as ListingRepo;
    const estateRepository = {
      findById: jest.fn().mockResolvedValue(estate),
      withLockedEstate: jest
        .fn()
        .mockImplementation(
          (
            _id: string,
            callback: (
              lockedEstate: Estate,
              manager: EntityManager,
            ) => Promise<unknown>,
          ) => callback(estate as Estate, {} as EntityManager),
        ),
    } as unknown as EstateRepo;
    const providerContextResolver = {
      resolve: jest.fn().mockResolvedValue({
        customerId,
        providerId,
        providerType: ProviderType.INDIVIDUAL,
        providerStatus: ProviderStatus.ACTIVE,
        verificationStatus: ProviderVerificationStatus.VERIFIED,
        providerDisplayName: 'Provider',
        membershipId: '80000000-0000-4000-8000-000000000001',
        membershipStatus: 'ACTIVE',
      }),
    } as unknown as ProviderContextResolver;
    const supplyAccessPolicy = {
      requireReadAccess: jest.fn(),
      requirePermission: jest.fn().mockResolvedValue(undefined),
    } as unknown as ProviderSupplyAccessPolicy;
    return new ListingService(
      listingRepository,
      estateRepository,
      providerContextResolver,
      supplyAccessPolicy,
    );
  };

  const buildLifecycleService = (status: ListingStatus) => {
    const service = buildService(estate);
    const repository = (
      service as unknown as { listingRepository: ListingRepo }
    ).listingRepository;
    jest.spyOn(repository, 'findById').mockResolvedValue({
      ...estateData,
      id: listingId,
      estateId,
      estate,
      providerId,
      status,
      publishedAt: status === ListingStatus.DRAFT ? null : new Date(),
    } as unknown as Listing);
    return { service, repository };
  };

  it('creates a draft that references an estate owned by the same provider', async () => {
    const service = buildService(estate);

    const dto: CreateListingDto = { estateId };
    const result = await service.create(customerId, dto);

    expect(result).toMatchObject({
      id: listingId,
      estateId,
      providerId,
      status: ListingStatus.DRAFT,
      estate: { id: estateId, title: 'Estate' },
    });
  });

  it('requires only listing:create for eligible property lookup', async () => {
    const service = buildService(estate);
    const repository = (
      service as unknown as { listingRepository: ListingRepo }
    ).listingRepository;
    jest
      .spyOn(repository, 'findEligibleForListing')
      .mockResolvedValue([{ id: estateId, title: 'Estate' }]);

    await expect(service.findEligibleProperties(customerId)).resolves.toEqual([
      { id: estateId, title: 'Estate' },
    ]);
    const policyMock = (
      service as unknown as { supplyAccessPolicy: ProviderSupplyAccessPolicy }
    ).supplyAccessPolicy as unknown as { requirePermission: jest.Mock };
    expect(policyMock.requirePermission.mock.calls).toContainEqual([
      expect.objectContaining({ providerId }),
      'listing:create',
    ]);
  });

  it('accepts an estate with a different legacy customer owner but the same provider', async () => {
    const service = buildService({
      ...estateData,
      customerId: '70000000-0000-4000-8000-000000000001',
    });

    await expect(
      service.create(customerId, { estateId }),
    ).resolves.toMatchObject({ id: listingId, status: ListingStatus.DRAFT });
  });

  it('rejects an estate owned by another provider', async () => {
    const service = buildService({
      ...estateData,
      providerId: otherProviderId,
    });

    await expect(
      service.create(customerId, { estateId }),
    ).rejects.toMatchObject({
      errorCode: CommonErrorCodes.FORBIDDEN.code,
    });
  });

  it('rejects creating a draft listing from an archived estate', async () => {
    const service = buildService({
      ...estateData,
      status: EstateStatus.ARCHIVED,
    });

    await expect(
      service.create(customerId, { estateId }),
    ).rejects.toMatchObject({
      errorCode: 'LISTING_PROPERTY_ARCHIVED',
    });
  });

  it('rejects a legacy estate without a provider binding', async () => {
    const service = buildService({
      ...estateData,
      providerId: null,
    });

    await expect(
      service.create(customerId, { estateId }),
    ).rejects.toMatchObject({
      errorCode: CommonErrorCodes.FORBIDDEN.code,
    });
  });

  it.each([
    [ListingStatus.PUBLISHED, 'publish'],
    [ListingStatus.ARCHIVED, 'publish'],
  ])('rejects %s -> publish', async (status) => {
    const { service } = buildLifecycleService(status);
    await expect(service.publish(customerId, listingId)).rejects.toMatchObject({
      errorCode: 'LISTING_INVALID_STATUS_TRANSITION',
    });
  });

  it.each([EstateStatus.DRAFT, EstateStatus.ARCHIVED])(
    'rejects publishing when the estate is %s',
    async (estateStatus) => {
      const service = buildService({ ...estateData, status: estateStatus });
      const repository = (
        service as unknown as { listingRepository: ListingRepo }
      ).listingRepository;
      jest.spyOn(repository, 'findById').mockResolvedValue({
        ...estateData,
        id: listingId,
        estateId,
        estate: { ...estateData, status: estateStatus },
        providerId,
        status: ListingStatus.DRAFT,
        publishedAt: null,
      } as unknown as Listing);

      await expect(
        service.publish(customerId, listingId),
      ).rejects.toMatchObject({
        errorCode: 'LISTING_PROPERTY_NOT_ACTIVE',
      });
    },
  );

  it.each([ListingStatus.DRAFT, ListingStatus.ARCHIVED])(
    'rejects %s -> archive',
    async (status) => {
      const { service } = buildLifecycleService(status);
      await expect(
        service.archive(customerId, listingId),
      ).rejects.toMatchObject({
        errorCode: 'LISTING_INVALID_STATUS_TRANSITION',
      });
    },
  );

  it('archives a published listing without clearing publishedAt', async () => {
    const { service } = buildLifecycleService(ListingStatus.PUBLISHED);
    const result = await service.archive(customerId, listingId);
    expect(result.status).toBe(ListingStatus.ARCHIVED);
    expect(result.publishedAt).toEqual(expect.any(Date));
  });
});
