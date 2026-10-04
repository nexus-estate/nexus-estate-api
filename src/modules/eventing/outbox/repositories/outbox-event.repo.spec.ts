import type { EntityManager } from 'typeorm';
import { OutboxEvent } from '../entities/outbox-event.entity';
import { OutboxEventRepo } from './outbox-event.repo';

describe('OutboxEventRepo', () => {
  const envelope = {
    eventId: '10000000-0000-4000-8000-000000000001',
    eventType: 'listing.search_projection_changed.v1',
    aggregateType: 'listing',
    aggregateId: '20000000-0000-4000-8000-000000000001',
    revision: '9007199254740993',
    occurredAt: '2026-10-03T08:20:31.245Z',
    traceId: null,
    payload: { deleted: true, document: null },
  };

  it('validates and stores the exact envelope through the supplied manager', async () => {
    const repository = {
      insert: jest.fn().mockResolvedValue({
        identifiers: [],
        generatedMaps: [],
        raw: [],
      }),
    };
    const managerMock = {
      getRepository: jest.fn().mockReturnValue(repository),
    };
    const manager = managerMock as unknown as EntityManager;

    await expect(new OutboxEventRepo().insert(envelope, manager)).resolves.toBe(
      undefined,
    );

    expect(managerMock.getRepository).toHaveBeenCalledWith(OutboxEvent);
    expect(repository.insert).toHaveBeenCalledWith({
      eventId: envelope.eventId,
      eventType: envelope.eventType,
      aggregateType: envelope.aggregateType,
      aggregateId: envelope.aggregateId,
      revision: envelope.revision,
      occurredAt: new Date(envelope.occurredAt),
      traceId: envelope.traceId,
      payload: envelope.payload,
    });
    expect(repository.insert).toHaveBeenCalledTimes(1);
  });

  it('rejects invalid envelopes before asking the manager for a repository', async () => {
    const managerMock = {
      getRepository: jest.fn(),
    };
    const manager = managerMock as unknown as EntityManager;

    await expect(
      new OutboxEventRepo().insert({ ...envelope, revision: '01' }, manager),
    ).rejects.toThrow('Event revision');
    expect(managerMock.getRepository).not.toHaveBeenCalled();
  });
});
