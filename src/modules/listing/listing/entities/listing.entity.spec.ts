import { getMetadataArgsStorage } from 'typeorm';
import { Listing, ListingStatus } from './listing.entity';

describe('Listing entity', () => {
  it('owns the marketplace table and draft default', () => {
    expect(
      getMetadataArgsStorage().tables.find((table) => table.target === Listing)
        ?.name,
    ).toBe('tbl_listing');
    expect(ListingStatus.DRAFT).toBe('DRAFT');
  });
});
