export const MARKETPLACE_LISTING_AGGREGATE_TYPE = 'listing';

export const MARKETPLACE_LISTING_SEARCH_PROJECTION_CHANGED_EVENT =
  'listing.search_projection_changed.v1';
export const MARKETPLACE_LISTING_PUBLISHED_EVENT = 'listing.published.v1';
export const MARKETPLACE_LISTING_ARCHIVED_EVENT = 'listing.archived.v1';

export type MarketplaceListingEventType =
  | typeof MARKETPLACE_LISTING_SEARCH_PROJECTION_CHANGED_EVENT
  | typeof MARKETPLACE_LISTING_PUBLISHED_EVENT
  | typeof MARKETPLACE_LISTING_ARCHIVED_EVENT;
