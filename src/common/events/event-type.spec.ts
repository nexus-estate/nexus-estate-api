import { assertEventType, isEventType } from './event-type';

describe('event type contract', () => {
  it.each([
    'listing.search_projection_changed.v1',
    'listing.published.v1',
    'listing.archived.v1',
    'listing.status_changed.v1',
    'property.updated.v2',
  ])('accepts %s', (eventType) => {
    expect(isEventType(eventType)).toBe(true);
    expect(() => assertEventType(eventType)).not.toThrow();
  });

  it.each([
    'Listing.Published.v1',
    'listing.published',
    'listing.published.V1',
    'listing..v1',
    'listing.published.v0',
    'listing-published-v1',
    'listing.search-projection-changed.v1',
    'listing.searchProjectionChanged.v1',
    'listing.search_projection_changed',
    'listing.search_projection_changed.v0',
  ])('rejects %s', (eventType) => {
    expect(isEventType(eventType)).toBe(false);
    expect(() => assertEventType(eventType)).toThrow();
  });
});
