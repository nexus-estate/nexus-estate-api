import { Listing, ListingStatus } from './index';

describe('listing entity barrel', () => {
  it('exposes the listing aggregate and lifecycle states', () => {
    expect(Listing).toBeDefined();
    expect(ListingStatus.PUBLISHED).toBe('PUBLISHED');
  });
});
