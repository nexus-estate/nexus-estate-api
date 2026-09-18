import { CommonErrorCodes } from '../../../../common/errors/common-error-codes';
import { Estate } from '../../../estate/property/entities/estate.entity';
import { EstateRepo } from '../../../estate/property/repositories/estate.repo';
import { ProviderAccountService } from '../../../provider/account/services/provider-account.service';
import { ProviderAuthorizationService } from '../../../provider/authorization/services/provider-authorization.service';
import { CreateListingDto } from '../dto/create-listing.dto';
import { Listing, ListingStatus } from '../entities';
import { ListingRepo } from '../repositories/listing.repo';
import { ListingService } from './listing.service';

describe('ListingService', () => {
  const customerId = '10000000-0000-4000-8000-000000000001';
  const providerId = '20000000-0000-4000-8000-000000000001';
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

  it('creates a draft that references an owned estate', async () => {
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
    const providerAccountService = {
      requireActiveProvider: jest.fn().mockResolvedValue({ providerId }),
    } as unknown as ProviderAccountService;
    const providerAuthorizationService = {
      requireLegacyEstateOwner: jest.fn().mockResolvedValue(undefined),
    } as unknown as ProviderAuthorizationService;
    const service = new ListingService(
      listingRepository,
      estateRepository,
      providerAccountService,
      providerAuthorizationService,
    );

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

  it('rejects an estate owned by another provider', async () => {
    const listingRepository = {} as ListingRepo;
    const estateRepository = {
      findById: jest.fn().mockResolvedValue({
        ...estateData,
        customerId: '70000000-0000-4000-8000-000000000001',
      }),
    } as unknown as EstateRepo;
    const providerAccountService = {
      requireActiveProvider: jest.fn().mockResolvedValue({ providerId }),
    } as unknown as ProviderAccountService;
    const service = new ListingService(
      listingRepository,
      estateRepository,
      providerAccountService,
      {} as ProviderAuthorizationService,
    );

    await expect(
      service.create(customerId, { estateId }),
    ).rejects.toMatchObject({
      errorCode: CommonErrorCodes.FORBIDDEN.code,
    });
  });
});
