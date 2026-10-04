import type { EventEnvelope } from '../../../../common/events/contracts/event-envelope.contract';
import { toMarketplaceKafkaRecord } from './marketplace-event-routing';

describe('toMarketplaceKafkaRecord', () => {
  const envelope: EventEnvelope<unknown> = {
    eventId: '10000000-0000-4000-8000-000000000001',
    eventType: 'listing.archived.v1',
    aggregateType: 'listing',
    aggregateId: '20000000-0000-4000-8000-000000000001',
    revision: '9007199254740993',
    occurredAt: '2026-10-03T08:20:31.245Z',
    traceId: 'trace-123',
    payload: { deleted: true, document: null },
  };

  it('uses the configured marketplace topic, Listing key, and exact envelope JSON', () => {
    const record = toMarketplaceKafkaRecord(
      'nexus.marketplace.listing.v1',
      envelope,
    );

    expect(record).toEqual({
      topic: 'nexus.marketplace.listing.v1',
      key: envelope.aggregateId,
      value: JSON.stringify(envelope),
    });
    expect(JSON.parse(record.value)).toEqual(envelope);
  });

  it('routes future Listing event types without changing their envelope', () => {
    const restored = {
      ...envelope,
      eventType: 'listing.restored.v1',
      payload: { deleted: false, document: { title: 'Restored' } },
    };
    expect(
      toMarketplaceKafkaRecord('nexus.marketplace.listing.v1', restored).value,
    ).toBe(JSON.stringify(restored));
  });

  it('rejects aggregates outside the marketplace Listing topic contract', () => {
    expect(() =>
      toMarketplaceKafkaRecord('nexus.marketplace.listing.v1', {
        ...envelope,
        aggregateType: 'customer',
      }),
    ).toThrow('Unsupported outbox aggregate type');
  });
});
