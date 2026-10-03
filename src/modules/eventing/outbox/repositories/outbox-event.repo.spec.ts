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
    const persisted = {
      ...envelope,
      occurredAt: new Date(envelope.occurredAt),
    };
    const repository = {
      create: jest.fn((value: unknown) => value),
      save: jest.fn().mockResolvedValue(persisted),
    };
    const managerMock = {
      getRepository: jest.fn().mockReturnValue(repository),
    };
    const manager = managerMock as unknown as EntityManager;

    const result = await new OutboxEventRepo().insert(envelope, manager);

    expect(managerMock.getRepository).toHaveBeenCalledWith(OutboxEvent);
    expect(repository.create).toHaveBeenCalledWith({
      ...envelope,
      occurredAt: new Date(envelope.occurredAt),
    });
    expect(repository.save).toHaveBeenCalledWith(
      repository.create.mock.results[0].value,
    );
    expect(result.revision).toBe('9007199254740993');
    expect(typeof result.revision).toBe('string');
    expect(result.payload).toBe(envelope.payload);
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
