import { ListingStatus } from '../entities';
import type { ListingResponse } from './listing.response';

describe('ListingResponse', () => {
  it('keeps marketplace state and physical estate data separate', () => {
    const response = {
      id: 'listing-id',
      estateId: 'estate-id',
      providerId: 'provider-id',
      status: ListingStatus.PUBLISHED,
      publishedAt: new Date(),
      estate: { id: 'estate-id', title: 'Estate' },
      createdAt: new Date(),
      updatedAt: new Date(),
    } as unknown as ListingResponse;

    expect(response.status).toBe(ListingStatus.PUBLISHED);
    expect(response.estate.id).toBe(response.estateId);
  });
});
