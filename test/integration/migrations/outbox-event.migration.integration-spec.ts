import {
  PostgreSqlContainer,
  type StartedPostgreSqlContainer,
} from '@testcontainers/postgresql';
import { DataSource } from 'typeorm';
import type { PostgresConnectionOptions } from 'typeorm/driver/postgres/PostgresConnectionOptions';

import { typeOrmConfig } from '../../../src/database/type.config';
import { CreateOutboxEventTable1791023416144 } from '../../../src/modules/eventing/outbox/migrations/1791023416144-CreateOutboxEventTable';

jest.setTimeout(120_000);

describe('Outbox event migration (PostgreSQL integration)', () => {
  let container: StartedPostgreSqlContainer;
  let dataSource: DataSource;

  beforeAll(async () => {
    container = await new PostgreSqlContainer('postgres:18-alpine')
      .withDatabase('nexus_estate_outbox_migration_test')
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
      entities: [],
      migrations: [],
    });
    await dataSource.initialize();
  });

  afterAll(async () => {
    await dataSource?.destroy();
    await container?.stop();
  });

  beforeEach(async () => {
    await dataSource.query('DROP TABLE IF EXISTS tbl_outbox_event CASCADE');
  });

  const runMigration = async (direction: 'up' | 'down'): Promise<void> => {
    const runner = dataSource.createQueryRunner();
    await runner.connect();
    try {
      await new CreateOutboxEventTable1791023416144()[direction](runner);
    } finally {
      await runner.release();
    }
  };

  it('creates the required schema, constraints, indexes, and reverses cleanly', async () => {
    await runMigration('up');

    await expect(
      dataSource.query(`
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns
        WHERE table_name = 'tbl_outbox_event'
        ORDER BY ordinal_position
      `),
    ).resolves.toEqual([
      {
        column_name: 'event_id',
        data_type: 'uuid',
        is_nullable: 'NO',
        column_default: null,
      },
      {
        column_name: 'event_type',
        data_type: 'character varying',
        is_nullable: 'NO',
        column_default: null,
      },
      {
        column_name: 'aggregate_type',
        data_type: 'character varying',
        is_nullable: 'NO',
        column_default: null,
      },
      {
        column_name: 'aggregate_id',
        data_type: 'uuid',
        is_nullable: 'NO',
        column_default: null,
      },
      {
        column_name: 'revision',
        data_type: 'bigint',
        is_nullable: 'NO',
        column_default: null,
      },
      {
        column_name: 'occurred_at',
        data_type: 'timestamp with time zone',
        is_nullable: 'NO',
        column_default: null,
      },
      {
        column_name: 'trace_id',
        data_type: 'character varying',
        is_nullable: 'YES',
        column_default: null,
      },
      {
        column_name: 'payload',
        data_type: 'jsonb',
        is_nullable: 'NO',
        column_default: null,
      },
      {
        column_name: 'created_at',
        data_type: 'timestamp with time zone',
        is_nullable: 'NO',
        column_default: 'now()',
      },
    ]);

    await dataSource.query(`
      INSERT INTO tbl_outbox_event
        (event_id, event_type, aggregate_type, aggregate_id, revision, occurred_at, trace_id, payload)
      VALUES
        ('10000000-0000-4000-8000-000000000001', 'listing.published.v1', 'listing',
         '20000000-0000-4000-8000-000000000001', '9223372036854775807', NOW(), NULL,
         '{"deleted":false,"document":{"price":"9007199254740993"}}'::jsonb)
    `);
    await expect(
      dataSource.query(
        `SELECT revision::text, trace_id, payload FROM tbl_outbox_event`,
      ),
    ).resolves.toEqual([
      {
        revision: '9223372036854775807',
        trace_id: null,
        payload: { deleted: false, document: { price: '9007199254740993' } },
      },
    ]);

    await expect(
      dataSource.query(`
        INSERT INTO tbl_outbox_event
          (event_id, event_type, aggregate_type, aggregate_id, revision, occurred_at, payload)
        VALUES ('10000000-0000-4000-8000-000000000002', 'listing.archived.v1', 'listing',
          '20000000-0000-4000-8000-000000000002', 0, NOW(), '{}')
      `),
    ).rejects.toThrow();
    await expect(
      dataSource.query(`
        INSERT INTO tbl_outbox_event
          (event_id, event_type, aggregate_type, aggregate_id, revision, occurred_at, payload)
        VALUES ('10000000-0000-4000-8000-000000000003', 'listing.archived.v1', 'listing',
          '20000000-0000-4000-8000-000000000002', -1, NOW(), '{}')
      `),
    ).rejects.toThrow();

    await expect(
      dataSource.query(`
        INSERT INTO tbl_outbox_event
          (event_id, event_type, aggregate_type, aggregate_id, revision, occurred_at, payload)
        VALUES ('10000000-0000-4000-8000-000000000004', 'listing.published.v1', 'listing',
          '20000000-0000-4000-8000-000000000001', '9223372036854775807', NOW(), '{}')
      `),
    ).rejects.toThrow();
    await expect(
      dataSource.query(`
        INSERT INTO tbl_outbox_event
          (event_id, event_type, aggregate_type, aggregate_id, revision, occurred_at, payload)
        VALUES ('10000000-0000-4000-8000-000000000005', 'listing.archived.v1', 'listing',
          '20000000-0000-4000-8000-000000000001', '9223372036854775807', NOW(), '{}')
      `),
    ).resolves.toBeDefined();

    await runMigration('down');
    await expect(
      dataSource.query(`
        SELECT table_name FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'tbl_outbox_event'
      `),
    ).resolves.toEqual([]);
  });
});
