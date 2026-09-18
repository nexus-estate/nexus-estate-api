import { ListingController } from './listing.controller';
import { ListingService } from '../services/listing.service';
import { ListingStatus } from '../entities';
import { ListingSort } from '../dto/listing-query.dto';
import type { CustomerPrincipal } from '../../../../common/security/auth.types';

describe('ListingController', () => {
  const user: CustomerPrincipal = {
    id: '10000000-0000-4000-8000-000000000001',
    email: 'owner@nexus.test',
    realm: 'customer',
  };
  const listing = {
    id: '20000000-0000-4000-8000-000000000001',
    status: ListingStatus.DRAFT,
  } as never;
  let service: jest.Mocked<
    Pick<ListingService, 'create' | 'findPublic' | 'publish'>
  >;
  let controller: ListingController;

  beforeEach(() => {
    service = {
      create: jest.fn(),
      findPublic: jest.fn(),
      publish: jest.fn(),
    };
    controller = new ListingController(service as unknown as ListingService);
  });

  it('delegates provider-scoped creation with principal and context', async () => {
    service.create.mockResolvedValue(listing);
    const dto = { estateId: '30000000-0000-4000-8000-000000000001' };

    await expect(controller.create(user, dto, 'provider-id')).resolves.toBe(
      listing,
    );
    expect(service.create).toHaveBeenCalledWith(user.id, dto, 'provider-id');
  });

  it('delegates public marketplace filtering', async () => {
    const query = { page: 1, limit: 20, sort: ListingSort.NEWEST };
    service.findPublic.mockResolvedValue({ items: [], meta: {} as never });

    await expect(controller.list(query)).resolves.toEqual({
      items: [],
      meta: {},
    });
    expect(service.findPublic).toHaveBeenCalledWith(query);
  });

  it('delegates publication to the provider context', async () => {
    service.publish.mockResolvedValue(listing);

    await expect(
      controller.publish(user, 'listing-id', 'provider-id'),
    ).resolves.toBe(listing);
    expect(service.publish).toHaveBeenCalledWith(
      user.id,
      'listing-id',
      'provider-id',
    );
  });
});
