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
    province: { id: 'province', code: '79', name: 'HCMC' },
    ward: { id: 'ward', code: '1', name: 'Ward 1' },
  };
  const estate = estateData as unknown as Estate;

  const buildService = (estate: unknown) => {
    const listingRepository = {
      findByEstateId: jest.fn().mockResolvedValue(null),
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
      requireWriteAccess: jest.fn().mockResolvedValue(undefined),
    } as unknown as ProviderSupplyAccessPolicy;
    return new ListingService(
      listingRepository,
      estateRepository,
      providerContextResolver,
      supplyAccessPolicy,
    );
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
});
