import { assertEventEnvelope } from './event-envelope.contract';

describe('EventEnvelope contract', () => {
  const payload = { listing: { id: 'snapshot-id', title: 'Home' } };
  const validEnvelope = () => ({
    eventId: '550e8400-e29b-41d4-a716-446655440000',
    eventType: 'listing.published.v1',
    aggregateType: 'listing',
    aggregateId: '123e4567-e89b-42d3-a456-426614174000',
    revision: '42',
    occurredAt: '2026-10-03T08:20:31.245Z',
    traceId: null,
    payload,
  });

  it('accepts a valid envelope and preserves payload data unchanged', () => {
    const envelope = validEnvelope();

    expect(() => assertEventEnvelope(envelope)).not.toThrow();
    expect(envelope.payload).toBe(payload);
  });

  it.each([
    ['eventId', 'not-a-uuid'],
    ['eventType', 'listing.published'],
    ['aggregateType', ''],
    ['aggregateId', 'listing-1'],
    ['revision', '01'],
    ['occurredAt', '2026-10-03T08:20:31.245+07:00'],
  ])('rejects an invalid %s', (field, value) => {
    const envelope = { ...validEnvelope(), [field]: value };
    expect(() => assertEventEnvelope(envelope)).toThrow();
  });

  it('allows a null trace ID', () => {
    expect(() => assertEventEnvelope(validEnvelope())).not.toThrow();
  });

  it('rejects invalid calendar dates and non-string trace IDs', () => {
    expect(() =>
      assertEventEnvelope({
        ...validEnvelope(),
        occurredAt: '2026-02-30T08:20:31.245Z',
      }),
    ).toThrow();
    expect(() =>
      assertEventEnvelope({ ...validEnvelope(), traceId: 123 }),
    ).toThrow();
  });
});
