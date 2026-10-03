import {
  buildMarketplaceListingProjectionPayload,
  type MarketplaceListingSourceRow,
} from './marketplace-listing-event.payload';

describe('Marketplace Listing event payload v1', () => {
  const searchableSource: MarketplaceListingSourceRow = {
    listingId: '10000000-0000-4000-8000-000000000001',
    listingStatus: 'PUBLISHED',
    listingIsLive: true,
    propertyId: '20000000-0000-4000-8000-000000000001',
    estateStatus: 'ACTIVE',
    estateIsLive: true,
    title: 'Home',
    description: null,
    type: 'APARTMENT',
    purpose: 'SALE',
    price: '9007199254740993',
    area: null,
    provinceId: '30000000-0000-4000-8000-000000000001',
    provinceName: 'Province',
    wardId: '40000000-0000-4000-8000-000000000001',
    wardName: 'Ward',
    address: '1 Main Street',
    latitude: '10.123456',
    longitude: '106.123456',
    publishedAt: '2026-10-03T08:20:31.245Z',
    updatedAt: '2026-10-03T08:20:31.245Z',
  };

  it('builds a full searchable document without numeric precision loss', () => {
    const payload = buildMarketplaceListingProjectionPayload(searchableSource, [
      'https://example.test/image.jpg',
    ]);

    expect(payload).toEqual({
      deleted: false,
      document: {
        listing_id: searchableSource.listingId,
        property_id: searchableSource.propertyId,
        title: 'Home',
        description: null,
        type: 'APARTMENT',
        purpose: 'SALE',
        price: '9007199254740993',
        area: null,
        province_id: searchableSource.provinceId,
        province_name: 'Province',
        ward_id: searchableSource.wardId,
        ward_name: 'Ward',
        address: '1 Main Street',
        location: { lat: '10.123456', lon: '106.123456' },
        media: { images: ['https://example.test/image.jpg'] },
        published_at: searchableSource.publishedAt,
        updated_at: searchableSource.updatedAt,
      },
    });
  });

  it.each([
    { override: { listingStatus: 'DRAFT' }, description: 'draft listing' },
    {
      override: { listingStatus: 'ARCHIVED' },
      description: 'archived listing',
    },
    { override: { estateStatus: 'ARCHIVED' }, description: 'archived estate' },
    { override: { estateIsLive: false }, description: 'soft-deleted estate' },
  ])('builds a tombstone for $description', ({ override }) => {
    expect(
      buildMarketplaceListingProjectionPayload(
        { ...searchableSource, ...override },
        [],
      ),
    ).toEqual({ deleted: true, document: null });
  });

  it('uses null location unless both coordinates are present', () => {
    const payload = buildMarketplaceListingProjectionPayload(
      { ...searchableSource, latitude: null },
      [],
    );
    expect(payload.document?.location).toBeNull();
  });

  it('caps images at twenty without inventing a cover image', () => {
    const images = Array.from({ length: 25 }, (_, index) => `image-${index}`);
    const payload = buildMarketplaceListingProjectionPayload(
      searchableSource,
      images,
    );
    expect(payload.document?.media.images).toEqual(images.slice(0, 20));
  });
});
