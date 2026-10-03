export interface MarketplaceListingSnapshotV1 {
  listing_id: string;
  property_id: string;
  title: string;
  description: string | null;
  type: string;
  purpose: string;
  price: string;
  area: string | null;
  province_id: string;
  province_name: string;
  ward_id: string;
  ward_name: string;
  address: string;
  location: { lat: string; lon: string } | null;
  media: { images: string[] };
  published_at: string;
  updated_at: string;
}

export interface MarketplaceListingProjectionEventPayloadV1 {
  deleted: boolean;
  document: MarketplaceListingSnapshotV1 | null;
}

/** Narrow source row loaded with the caller's transaction manager. */
export interface MarketplaceListingSourceRow {
  listingId: string;
  listingStatus: string;
  listingIsLive: boolean;
  propertyId: string | null;
  estateStatus: string | null;
  estateIsLive: boolean;
  title: string | null;
  description: string | null;
  type: string | null;
  purpose: string | null;
  price: string | null;
  area: string | null;
  provinceId: string | null;
  provinceName: string | null;
  wardId: string | null;
  wardName: string | null;
  address: string | null;
  latitude: string | null;
  longitude: string | null;
  publishedAt: string | null;
  updatedAt: string | null;
}

const MAX_MARKETPLACE_IMAGES = 20;

export function isSearchableMarketplaceListing(
  source: MarketplaceListingSourceRow,
): boolean {
  return (
    source.listingIsLive &&
    source.listingStatus === 'PUBLISHED' &&
    source.estateIsLive &&
    source.estateStatus === 'ACTIVE'
  );
}

/** Applies API-owned searchability and maps canonical source values losslessly. */
export function buildMarketplaceListingProjectionPayload(
  source: MarketplaceListingSourceRow,
  imageUrls: string[],
): MarketplaceListingProjectionEventPayloadV1 {
  if (!isSearchableMarketplaceListing(source)) {
    return { deleted: true, document: null };
  }

  const propertyId = required(source.propertyId, 'propertyId');
  const latitude = source.latitude;
  const longitude = source.longitude;

  return {
    deleted: false,
    document: {
      listing_id: source.listingId,
      property_id: propertyId,
      title: required(source.title, 'title'),
      description: source.description,
      type: required(source.type, 'type'),
      purpose: required(source.purpose, 'purpose'),
      price: required(source.price, 'price'),
      area: source.area,
      province_id: required(source.provinceId, 'provinceId'),
      province_name: required(source.provinceName, 'provinceName'),
      ward_id: required(source.wardId, 'wardId'),
      ward_name: required(source.wardName, 'wardName'),
      address: required(source.address, 'address'),
      location:
        latitude !== null && longitude !== null
          ? { lat: latitude, lon: longitude }
          : null,
      media: { images: imageUrls.slice(0, MAX_MARKETPLACE_IMAGES) },
      published_at: required(source.publishedAt, 'publishedAt'),
      updated_at: required(source.updatedAt, 'updatedAt'),
    },
  };
}

function required(value: string | null, field: string): string {
  if (value === null) {
    throw new TypeError(
      `Searchable Marketplace Listing source is missing ${field}`,
    );
  }
  return value;
}
