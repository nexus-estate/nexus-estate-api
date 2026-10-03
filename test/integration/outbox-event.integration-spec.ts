import {
  PostgreSqlContainer,
  type StartedPostgreSqlContainer,
} from '@testcontainers/postgresql';
import { DataSource } from 'typeorm';
import type { PostgresConnectionOptions } from 'typeorm/driver/postgres/PostgresConnectionOptions';

import { typeOrmConfig } from '../../src/database/type.config';
import { CreateOutboxEventTable1791023416144 } from '../../src/modules/eventing/outbox/migrations/1791023416144-CreateOutboxEventTable';
import { OutboxEvent } from '../../src/modules/eventing/outbox/entities/outbox-event.entity';
import { OutboxEventRepo } from '../../src/modules/eventing/outbox/repositories/outbox-event.repo';

jest.setTimeout(120_000);

describe('OutboxEventRepo (PostgreSQL integration)', () => {
  let container: StartedPostgreSqlContainer;
  let dataSource: DataSource;
  const repository = new OutboxEventRepo();
  const envelope = {
    eventId: '10000000-0000-4000-8000-000000000001',
    eventType: 'listing.search_projection_changed.v1',
    aggregateType: 'listing',
    aggregateId: '20000000-0000-4000-8000-000000000001',
    revision: '9007199254740993',
    occurredAt: '2026-10-03T08:20:31.245Z',
    traceId: null,
    payload: {
      deleted: false,
      document: { price: '9007199254740993' },
    },
  };

  beforeAll(async () => {
    container = await new PostgreSqlContainer('postgres:18-alpine')
      .withDatabase('nexus_estate_outbox_repo_test')
      .withUsername('test')
      .withPassword('test')
      .start();
    dataSource = new DataSource({
      ...(typeOrmConfig as PostgresConnectionOptions),
      type: 'postgres',
      host: container.getHost(),
      port: container.getMappedPort(5432),
      username: container.getUsername(),
      password: container.getPassword(),
      database: container.getDatabase(),
      entities: [OutboxEvent],
      migrations: [],
    });
    await dataSource.initialize();
    const runner = dataSource.createQueryRunner();
    await runner.connect();
    try {
      await new CreateOutboxEventTable1791023416144().up(runner);
    } finally {
      await runner.release();
    }
  });

  afterAll(async () => {
    await dataSource?.destroy();
    await container?.stop();
  });

  beforeEach(async () => {
    await dataSource.query('TRUNCATE TABLE tbl_outbox_event');
  });

  it('persists lossless revision, nullable trace, and exact JSONB payload', async () => {
    await repository.insert(envelope, dataSource.manager);
    await expect(
      dataSource.query(
        `
        SELECT event_id, revision::text, trace_id, payload
        FROM tbl_outbox_event WHERE event_id = $1
      `,
        [envelope.eventId],
      ),
    ).resolves.toEqual([
      {
        event_id: envelope.eventId,
        revision: '9007199254740993',
        trace_id: null,
        payload: envelope.payload,
      },
    ]);
  });

  it('cannot overwrite a committed event when event_id is reused', async () => {
    const originalEnvelope = {
      ...envelope,
      payload: { deleted: false, document: { title: 'Original' } },
    };
    await repository.insert(originalEnvelope, dataSource.manager);

    await expect(
      repository.insert(
        {
          ...originalEnvelope,
          revision: '2',
          payload: { deleted: false, document: { title: 'Mutated' } },
        },
        dataSource.manager,
      ),
    ).rejects.toMatchObject({
      driverError: {
        code: '23505',
        constraint: 'tbl_outbox_event_pkey',
      },
    });

    await expect(
      dataSource.query(
        `SELECT event_id, revision::text, payload
         FROM tbl_outbox_event WHERE event_id = $1`,
        [envelope.eventId],
      ),
    ).resolves.toEqual([
      {
        event_id: envelope.eventId,
        revision: envelope.revision,
        payload: originalEnvelope.payload,
      },
    ]);
  });

  it('rolls back the outbox row with the caller transaction', async () => {
    await expect(
      dataSource.transaction(async (manager) => {
        await repository.insert(envelope, manager);
        throw new Error('force rollback');
      }),
    ).rejects.toThrow('force rollback');

    await expect(dataSource.getRepository(OutboxEvent).count()).resolves.toBe(
      0,
    );
  });

  it('rejects duplicate producer stream keys', async () => {
    await repository.insert(envelope, dataSource.manager);
    await expect(
      repository.insert(
        {
          ...envelope,
          eventId: '10000000-0000-4000-8000-000000000002',
        },
        dataSource.manager,
      ),
    ).rejects.toMatchObject({
      driverError: {
        code: '23505',
        constraint: 'uq_outbox_event_stream_revision_type',
      },
    });
  });

  it('allows another event type at the same producer revision', async () => {
    await repository.insert(envelope, dataSource.manager);
    await expect(
      repository.insert(
        {
          ...envelope,
          eventId: '10000000-0000-4000-8000-000000000003',
          eventType: 'listing.published.v1',
        },
        dataSource.manager,
      ),
    ).resolves.toBeUndefined();
  });
});
