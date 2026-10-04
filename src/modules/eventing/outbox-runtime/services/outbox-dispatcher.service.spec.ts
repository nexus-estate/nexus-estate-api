import type { ConfigService } from '@nestjs/config';
import type { EventEnvelope } from '../../../../common/events/contracts/event-envelope.contract';
import type { ClaimedOutboxEvent } from '../../outbox/types/claimed-outbox-event';
import { OutboxDeliveryRepo } from '../../outbox/repositories/outbox-delivery.repo';
import type { EventPublisher } from '../types/event-publisher';
import { OutboxDispatcherService } from './outbox-dispatcher.service';
import { OutboxMetricsService } from './outbox-metrics.service';

const envelope: EventEnvelope<unknown> = {
  eventId: '10000000-0000-4000-8000-000000000001',
  eventType: 'listing.published.v1',
  aggregateType: 'listing',
  aggregateId: '20000000-0000-4000-8000-000000000001',
  revision: '7',
  occurredAt: '2026-10-03T08:20:31.245Z',
  traceId: null,
  payload: { deleted: false, document: { title: 'Stored title' } },
};

const config = {
  get: (key: string) =>
    key === 'OUTBOX_INSTANCE_ID' ? 'publisher-test' : undefined,
  getOrThrow: (key: string) =>
    ({
      OUTBOX_BATCH_SIZE: 2,
      OUTBOX_POLL_INTERVAL_MS: 10,
      OUTBOX_LEASE_MS: 5_000,
      OUTBOX_RETRY_BASE_MS: 1_000,
      OUTBOX_RETRY_MAX_MS: 30_000,
      OUTBOX_DRAIN_TIMEOUT_MS: 100,
      KAFKA_TOPIC_MARKETPLACE_LISTING: 'nexus.marketplace.listing.v1',
    })[key],
} as unknown as ConfigService;

describe('OutboxDispatcherService', () => {
  it('waits for Kafka ACK before marking the unchanged persisted event delivered', async () => {
    const order: string[] = [];
    const markDelivered = jest.fn(() => {
      order.push('delivered_mark');
      return Promise.resolve(true);
    });
    const publisher = publisherMock({
      publish: (event) => {
        expect(event).toBe(envelope);
        order.push('ack');
        return Promise.resolve();
      },
    });
    const repo = repositoryMock({
      claimBatch: jest
        .fn()
        .mockResolvedValueOnce([claimedEvent()])
        .mockResolvedValue([]),
      markDelivered,
    });
    const dispatcher = new OutboxDispatcherService(
      repo,
      publisher,
      new OutboxMetricsService(),
      config,
    );

    await dispatcher.start();
    await new Promise((resolve) => setTimeout(resolve, 5));
    await dispatcher.onApplicationShutdown();

    expect(order).toEqual(['ack', 'delivered_mark']);
    expect(markDelivered).toHaveBeenCalledWith(
      envelope.eventId,
      'publisher-test',
    );
  });

  it('keeps polling after broker startup failure and recovers when it reconnects', async () => {
    let connected = false;
    const connect = jest
      .fn()
      .mockImplementationOnce(() =>
        Promise.reject(new Error('broker unavailable')),
      )
      .mockImplementation(() => {
        connected = true;
        return Promise.resolve();
      });
    const claimBatch = jest.fn().mockResolvedValue([]);
    const publisher: EventPublisher = {
      connect,
      publish: jest.fn().mockResolvedValue(undefined),
      disconnect: jest.fn().mockResolvedValue(undefined),
      isConnected: () => connected,
    };
    const repo = repositoryMock({
      claimBatch,
    });
    const dispatcher = new OutboxDispatcherService(
      repo,
      publisher,
      new OutboxMetricsService(),
      config,
    );

    await dispatcher.start();
    await new Promise((resolve) => setTimeout(resolve, 25));
    await dispatcher.onApplicationShutdown();

    expect(dispatcher.isInitialized()).toBe(false);
    expect(connect).toHaveBeenCalledTimes(2);
    expect(claimBatch).toHaveBeenCalled();
  });

  it('stops new claims and drains in-flight delivery before disconnecting', async () => {
    let finishPublish: (() => void) | undefined;
    const markDelivered = jest.fn().mockResolvedValue(true);
    const disconnect = jest.fn().mockResolvedValue(undefined);
    const claimBatch = jest
      .fn()
      .mockResolvedValueOnce([claimedEvent()])
      .mockResolvedValue([]);
    const publisher = publisherMock({
      disconnect,
      publish: () =>
        new Promise<void>((resolve) => {
          finishPublish = resolve;
        }),
    });
    const repo = repositoryMock({
      claimBatch,
      markDelivered,
    });
    const dispatcher = new OutboxDispatcherService(
      repo,
      publisher,
      new OutboxMetricsService(),
      config,
    );

    await dispatcher.start();
    await waitUntil(() => finishPublish !== undefined);
    const shutdown = dispatcher.onApplicationShutdown();
    finishPublish?.();
    await shutdown;

    expect(markDelivered).toHaveBeenCalledTimes(1);
    expect(disconnect).toHaveBeenCalledTimes(1);
    expect(claimBatch).toHaveBeenCalledTimes(1);
  });

  it('schedules durable retry after a publish error without marking delivery', async () => {
    const scheduleRetry = jest.fn().mockResolvedValue(true);
    const markDelivered = jest.fn().mockResolvedValue(false);
    const publisher = publisherMock({
      publish: () => Promise.reject(new Error('broker unavailable')),
    });
    const repo = repositoryMock({
      claimBatch: jest
        .fn()
        .mockResolvedValueOnce([claimedEvent()])
        .mockResolvedValue([]),
      scheduleRetry,
      markDelivered,
    });
    const dispatcher = new OutboxDispatcherService(
      repo,
      publisher,
      new OutboxMetricsService(),
      config,
    );

    await dispatcher.start();
    await new Promise((resolve) => setTimeout(resolve, 5));
    await dispatcher.onApplicationShutdown();

    expect(scheduleRetry).toHaveBeenCalledWith(
      envelope.eventId,
      'publisher-test',
      expect.any(Number),
      'Error',
      'broker unavailable',
    );
    expect(markDelivered).not.toHaveBeenCalled();
  });
});

function claimedEvent(): ClaimedOutboxEvent {
  return { envelope, attemptCount: 1, leaseExpired: false };
}

function repositoryMock(
  overrides: Partial<OutboxDeliveryRepo>,
): OutboxDeliveryRepo {
  return {
    claimBatch: jest.fn().mockResolvedValue([]),
    markDelivered: jest.fn().mockResolvedValue(false),
    scheduleRetry: jest.fn().mockResolvedValue(false),
    getBacklogStats: jest.fn(),
    ...overrides,
  } as unknown as OutboxDeliveryRepo;
}

function publisherMock(overrides: Partial<EventPublisher>): EventPublisher {
  let connected = false;
  return {
    connect: jest.fn(() => {
      connected = true;
      return Promise.resolve();
    }),
    publish: jest.fn().mockResolvedValue(undefined),
    disconnect: jest.fn(() => {
      connected = false;
      return Promise.resolve();
    }),
    isConnected: () => connected,
    ...overrides,
  };
}

async function waitUntil(predicate: () => boolean): Promise<void> {
  const deadline = Date.now() + 1_000;
  while (!predicate() && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 1));
  }
  expect(predicate()).toBe(true);
}
