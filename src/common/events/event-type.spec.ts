import { assertEventType, isEventType } from './event-type';

describe('event type contract', () => {
  it.each([
    'listing.published.v1',
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
  ])('rejects %s', (eventType) => {
    expect(isEventType(eventType)).toBe(false);
    expect(() => assertEventType(eventType)).toThrow();
  });
});
