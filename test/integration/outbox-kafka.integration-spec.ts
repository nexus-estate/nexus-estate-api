import { createServer } from 'node:net';
import {
  PostgreSqlContainer,
  type StartedPostgreSqlContainer,
} from '@testcontainers/postgresql';
import {
  GenericContainer,
  Wait,
  type StartedTestContainer,
} from 'testcontainers';
import { DataSource } from 'typeorm';
import type { ConfigService } from '@nestjs/config';
import type { PostgresConnectionOptions } from 'typeorm/driver/postgres/PostgresConnectionOptions';

import { typeOrmConfig } from '../../src/database/type.config';
import { CreateOutboxEventTable1791023416144 } from '../../src/modules/eventing/outbox/migrations/1791023416144-CreateOutboxEventTable';
import { CreateOutboxDeliveryTable1791094051668 } from '../../src/modules/eventing/outbox/migrations/1791094051668-CreateOutboxDeliveryTable';
import { OutboxDeliveryRepo } from '../../src/modules/eventing/outbox/repositories/outbox-delivery.repo';
import type { KafkaEventPublisher } from '../../src/modules/eventing/outbox-runtime/services/kafka-event-publisher.service';

jest.setTimeout(180_000);

const supportsProductionNode =
  Number(process.versions.node.split('.')[0]) === 24;
const describeOnProductionNode = supportsProductionNode
  ? describe
  : describe.skip;

describeOnProductionNode('Outbox Kafka integration (Redpanda)', () => {
  let postgres: StartedPostgreSqlContainer;
  let kafka: StartedTestContainer | undefined;
  let dataSource: DataSource;
  let deliveryRepo: OutboxDeliveryRepo;
  let publisher: KafkaEventPublisher | undefined;
  let consumer:
    import('@confluentinc/kafka-javascript').KafkaJS.Consumer | undefined;
  let sdk: typeof import('@confluentinc/kafka-javascript');
  let brokerPort: number;
  const topic = 'nexus.marketplace.listing.v1';

  beforeAll(async () => {
    brokerPort = await freeHostPort();
    postgres = await new PostgreSqlContainer('postgres:18-alpine')
      .withDatabase('nexus_estate_outbox_kafka_test')
      .withUsername('test')
      .withPassword('test')
      .start();
    dataSource = new DataSource({
      ...(typeOrmConfig as PostgresConnectionOptions),
      type: 'postgres',
      host: postgres.getHost(),
      port: postgres.getMappedPort(5432),
      username: postgres.getUsername(),
      password: postgres.getPassword(),
      database: postgres.getDatabase(),
      entities: [],
      migrations: [],
    });
    await dataSource.initialize();
    await runMigration(dataSource, new CreateOutboxEventTable1791023416144());
    await runMigration(
      dataSource,
      new CreateOutboxDeliveryTable1791094051668(),
    );
    deliveryRepo = new OutboxDeliveryRepo(dataSource);

    sdk = jest.requireActual<typeof import('@confluentinc/kafka-javascript')>(
      '@confluentinc/kafka-javascript',
    );
    const { KafkaEventPublisher } = jest.requireActual<
      typeof import('../../src/modules/eventing/outbox-runtime/services/kafka-event-publisher.service')
    >(
      '../../src/modules/eventing/outbox-runtime/services/kafka-event-publisher.service',
    );
    publisher = new KafkaEventPublisher(
      kafkaConfig(`127.0.0.1:${brokerPort}`) as unknown as ConfigService,
    );
  });

  afterAll(async () => {
    await consumer?.disconnect().catch(() => undefined);
    await publisher?.disconnect().catch(() => undefined);
    await dataSource?.destroy();
    await postgres?.stop();
    await kafka?.stop();
  });

  it('keeps work pending through broker outage, then delivers exact and duplicate envelopes', async () => {
    await insertEvent(
      dataSource,
      '10000000-0000-4000-8000-000000000001',
      '20000000-0000-4000-8000-000000000001',
      1,
    );

    const kafkaPublisher = publisher!;
    await expect(kafkaPublisher.connect()).rejects.toThrow();
    await expect(
      dataSource.query(`
        SELECT attempt_count, delivered_at
        FROM tbl_outbox_delivery
        WHERE event_id = '10000000-0000-4000-8000-000000000001'
      `),
    ).resolves.toEqual([{ attempt_count: 0, delivered_at: null }]);

    kafka = await startRedpanda(brokerPort);
    await kafkaPublisher.connect();

    const kafkaClient = new sdk.KafkaJS.Kafka();
    const admin = kafkaClient.admin({
      'bootstrap.servers': `127.0.0.1:${brokerPort}`,
    });
    await admin.connect();
    await admin.createTopics({
      topics: [{ topic, numPartitions: 1, replicationFactor: 1 }],
      timeout: 10_000,
    });
    await admin.disconnect();

    consumer = kafkaClient.consumer({
      'bootstrap.servers': `127.0.0.1:${brokerPort}`,
      'group.id': 'outbox-integration-diagnostic',
      'auto.offset.reset': 'earliest',
      kafkaJS: {
        groupId: 'outbox-integration-diagnostic',
        fromBeginning: true,
        autoCommit: false,
      },
    });
    const received: { key: string | null; value: string | null }[] = [];
    await consumer.connect();
    await consumer.subscribe({ topics: [topic] });
    await consumer.run({
      eachMessage: async ({ message }) => {
        received.push({
          key: message.key?.toString() ?? null,
          value: message.value?.toString() ?? null,
        });
        await Promise.resolve();
      },
    });

    const [first] = await deliveryRepo.claimBatch('publisher-a', 1, 50);
    await kafkaPublisher.publish(first.envelope);
    await expect(
      deliveryRepo.markDelivered(first.envelope.eventId, 'publisher-a'),
    ).resolves.toBe(true);
    await waitForCount(received, 1);
    expect(received[0]).toEqual({
      key: first.envelope.aggregateId,
      value: JSON.stringify(first.envelope),
    });
    expect(JSON.parse(received[0].value!)).toEqual(first.envelope);

    await insertEvent(
      dataSource,
      '10000000-0000-4000-8000-000000000002',
      '20000000-0000-4000-8000-000000000001',
      2,
    );
    const [beforeCrash] = await deliveryRepo.claimBatch('publisher-a', 1, 50);
    await kafkaPublisher.publish(beforeCrash.envelope);
    await waitForCount(received, 2);
    await new Promise((resolve) => setTimeout(resolve, 75));

    const [afterRestart] = await deliveryRepo.claimBatch(
      'publisher-b',
      1,
      5_000,
    );
    expect(afterRestart.envelope).toEqual(beforeCrash.envelope);
    await kafkaPublisher.publish(afterRestart.envelope);
    await expect(
      deliveryRepo.markDelivered(afterRestart.envelope.eventId, 'publisher-b'),
    ).resolves.toBe(true);
    await waitForCount(received, 3);
    expect(received[1]).toEqual(received[2]);
    expect(JSON.parse(received[2].value!)).toEqual(beforeCrash.envelope);

    await consumer.disconnect();
    consumer = undefined;
  });
});

async function startRedpanda(hostPort: number): Promise<StartedTestContainer> {
  return new GenericContainer('redpandadata/redpanda:v24.3.8')
    .withCommand([
      'redpanda',
      'start',
      '--mode',
      'dev-container',
      '--smp',
      '1',
      '--memory',
      '1G',
      '--reserve-memory',
      '0M',
      '--overprovisioned',
      '--check=false',
      '--kafka-addr',
      '0.0.0.0:9092',
      '--advertise-kafka-addr',
      `127.0.0.1:${hostPort}`,
    ])
    .withExposedPorts({ container: 9092, host: hostPort })
    .withWaitStrategy(Wait.forListeningPorts())
    .withStartupTimeout(120_000)
    .start();
}

function kafkaConfig(broker: string) {
  const values: Record<string, string | number | string[]> = {
    KAFKA_TOPIC_MARKETPLACE_LISTING: 'nexus.marketplace.listing.v1',
    OUTBOX_PUBLISH_TIMEOUT_MS: 1_500,
    KAFKA_SECURITY_PROTOCOL: 'plaintext',
    KAFKA_BROKERS: [broker],
    KAFKA_CLIENT_ID: 'nexus-outbox-integration',
  };
  return {
    getOrThrow: (key: string) => values[key],
  };
}

async function insertEvent(
  dataSource: DataSource,
  eventId: string,
  aggregateId: string,
  revision: number,
): Promise<void> {
  await dataSource.query(
    `
      INSERT INTO tbl_outbox_event
        (event_id, event_type, aggregate_type, aggregate_id, revision,
         occurred_at, payload)
      VALUES ($1, 'listing.published.v1', 'listing', $2, $3, NOW(), $4::jsonb)
    `,
    [
      eventId,
      aggregateId,
      revision,
      JSON.stringify({
        deleted: false,
        document: { title: `Revision ${revision}` },
      }),
    ],
  );
}

async function runMigration(
  dataSource: DataSource,
  migration: { up(queryRunner: import('typeorm').QueryRunner): Promise<void> },
): Promise<void> {
  const runner = dataSource.createQueryRunner();
  await runner.connect();
  try {
    await migration.up(runner);
  } finally {
    await runner.release();
  }
}

async function freeHostPort(): Promise<number> {
  const server = createServer();
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  if (!address || typeof address === 'string') {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    throw new Error('Could not reserve a local Kafka port');
  }
  await new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
  return address.port;
}

async function waitForCount(
  messages: unknown[],
  target: number,
): Promise<void> {
  const deadline = Date.now() + 15_000;
  while (messages.length < target && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  expect(messages).toHaveLength(target);
}
