import type { ConfigService } from '@nestjs/config';
import type { EventEnvelope } from '../../../../common/events/contracts/event-envelope.contract';

function createMockProducer() {
  const producer = {
    connect: jest.fn<Promise<void>, []>(),
    disconnect: jest.fn<Promise<void>, []>(),
    send: jest.fn(),
  };
  producer.connect.mockResolvedValue(undefined);
  producer.disconnect.mockResolvedValue(undefined);
  producer.send.mockResolvedValue([{ errorCode: 0 }]);
  return producer;
}

const mockProducer = createMockProducer();
const mockProducerFactory = jest.fn<unknown, []>();

jest.mock('@confluentinc/kafka-javascript', () => ({
  KafkaJS: {
    Kafka: class {
      producer() {
        return mockProducerFactory() as never;
      }
    },
  },
}));

import { KafkaEventPublisher } from './kafka-event-publisher.service';

describe('KafkaEventPublisher', () => {
  const values: Record<string, string | number | string[]> = {
    KAFKA_TOPIC_MARKETPLACE_LISTING: 'nexus.marketplace.listing.v1',
    OUTBOX_PUBLISH_TIMEOUT_MS: 30_000,
    KAFKA_SECURITY_PROTOCOL: 'plaintext',
    KAFKA_BROKERS: ['kafka-1:9092'],
    KAFKA_CLIENT_ID: 'nexus-outbox',
  };
  const config = {
    getOrThrow: (key: string) => values[key],
  } as ConfigService;
  const envelope: EventEnvelope<unknown> = {
    eventId: '10000000-0000-4000-8000-000000000001',
    eventType: 'listing.published.v1',
    aggregateType: 'listing',
    aggregateId: '20000000-0000-4000-8000-000000000001',
    revision: '9007199254740993',
    occurredAt: '2026-10-03T08:20:31.245Z',
    traceId: null,
    payload: { deleted: false, document: { price: '9007199254740993' } },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockProducerFactory.mockReset().mockReturnValue(mockProducer);
    mockProducer.connect.mockResolvedValue(undefined);
    mockProducer.disconnect.mockResolvedValue(undefined);
    mockProducer.send.mockResolvedValue([
      {
        errorCode: 0,
        offset: '1',
        partition: 0,
        topicName: values.KAFKA_TOPIC_MARKETPLACE_LISTING,
      },
    ]);
  });

  it('waits for producer connection and sends the exact stored envelope', async () => {
    const publisher = new KafkaEventPublisher(config);
    await publisher.connect();
    await publisher.publish(envelope);

    expect(publisher.isConnected()).toBe(true);
    expect(mockProducer.send).toHaveBeenCalledWith({
      topic: 'nexus.marketplace.listing.v1',
      messages: [
        { key: envelope.aggregateId, value: JSON.stringify(envelope) },
      ],
    });
  });

  it('recreates the one-shot producer after a failed broker connection', async () => {
    const publisher = new KafkaEventPublisher(config);
    const recoveredProducer = createMockProducer();
    mockProducer.connect.mockRejectedValueOnce(new Error('broker unavailable'));

    await expect(publisher.connect()).rejects.toThrow('broker unavailable');
    expect(publisher.isConnected()).toBe(false);
    mockProducerFactory.mockReturnValueOnce(recoveredProducer);

    await publisher.connect();
    await publisher.publish(envelope);

    expect(publisher.isConnected()).toBe(true);
    expect(mockProducerFactory).toHaveBeenCalledTimes(2);
    expect(recoveredProducer.send).toHaveBeenCalledWith({
      topic: 'nexus.marketplace.listing.v1',
      messages: [
        { key: envelope.aggregateId, value: JSON.stringify(envelope) },
      ],
    });
  });

  it('replaces the producer after a send failure before reconnecting', async () => {
    const publisher = new KafkaEventPublisher(config);
    const recoveredProducer = createMockProducer();
    await publisher.connect();
    mockProducer.send.mockRejectedValueOnce(new Error('broker unavailable'));

    await expect(publisher.publish(envelope)).rejects.toThrow(
      'broker unavailable',
    );
    expect(publisher.isConnected()).toBe(false);
    expect(mockProducer.disconnect).not.toHaveBeenCalled();
    mockProducerFactory.mockReturnValueOnce(recoveredProducer);

    await publisher.connect();
    await publisher.publish(envelope);

    expect(mockProducer.disconnect).toHaveBeenCalledTimes(1);
    expect(recoveredProducer.send).toHaveBeenCalledTimes(1);
    expect(publisher.isConnected()).toBe(true);
  });
});
