import {
  PostgreSqlContainer,
  type StartedPostgreSqlContainer,
} from '@testcontainers/postgresql';
import { DataSource } from 'typeorm';
import type { PostgresConnectionOptions } from 'typeorm/driver/postgres/PostgresConnectionOptions';

import { typeOrmConfig } from '../../../src/database/type.config';
import { CreateOutboxEventTable1791023416144 } from '../../../src/modules/eventing/outbox/migrations/1791023416144-CreateOutboxEventTable';
import { CreateOutboxDeliveryTable1791094051668 } from '../../../src/modules/eventing/outbox/migrations/1791094051668-CreateOutboxDeliveryTable';

jest.setTimeout(120_000);

describe('Outbox delivery migration (PostgreSQL 18 integration)', () => {
  let container: StartedPostgreSqlContainer;
  let dataSource: DataSource;

  beforeAll(async () => {
    container = await new PostgreSqlContainer('postgres:18-alpine')
      .withDatabase('nexus_estate_outbox_delivery_migration_test')
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
    await dataSource.query('DROP TABLE IF EXISTS tbl_outbox_delivery CASCADE');
    await dataSource.query('DROP TABLE IF EXISTS tbl_outbox_event CASCADE');
    await dataSource.query(
      'DROP FUNCTION IF EXISTS public.create_outbox_delivery_state()',
    );
    const runner = dataSource.createQueryRunner();
    await runner.connect();
    try {
      await new CreateOutboxEventTable1791023416144().up(runner);
    } finally {
      await runner.release();
    }
  });

  const runDeliveryMigration = async (
    direction: 'up' | 'down',
  ): Promise<void> => {
    const runner = dataSource.createQueryRunner();
    await runner.connect();
    try {
      await new CreateOutboxDeliveryTable1791094051668()[direction](runner);
    } finally {
      await runner.release();
    }
  };

  it('backfills existing events and creates delivery state for later inserts', async () => {
    await dataSource.query(`
      INSERT INTO tbl_outbox_event
        (event_id, event_type, aggregate_type, aggregate_id, revision,
         occurred_at, payload)
      VALUES
        ('10000000-0000-4000-8000-000000000001', 'listing.published.v1',
         'listing', '20000000-0000-4000-8000-000000000001', 1, NOW(), '{}'),
        ('10000000-0000-4000-8000-000000000002', 'listing.archived.v1',
         'listing', '20000000-0000-4000-8000-000000000002', 1, NOW(), '{}')
    `);

    await runDeliveryMigration('up');
    await expect(
      dataSource.query(`
        SELECT event_id, attempt_count, delivered_at
        FROM tbl_outbox_delivery ORDER BY event_id
      `),
    ).resolves.toEqual([
      {
        event_id: '10000000-0000-4000-8000-000000000001',
        attempt_count: 0,
        delivered_at: null,
      },
      {
        event_id: '10000000-0000-4000-8000-000000000002',
        attempt_count: 0,
        delivered_at: null,
      },
    ]);

    await dataSource.query(`
      INSERT INTO tbl_outbox_event
        (event_id, event_type, aggregate_type, aggregate_id, revision,
         occurred_at, payload)
      VALUES
        ('10000000-0000-4000-8000-000000000003', 'listing.published.v1',
         'listing', '20000000-0000-4000-8000-000000000003', 1, NOW(), '{}')
    `);
    await expect(
      dataSource.query(
        'SELECT event_id FROM tbl_outbox_delivery WHERE event_id = $1',
        ['10000000-0000-4000-8000-000000000003'],
      ),
    ).resolves.toEqual([{ event_id: '10000000-0000-4000-8000-000000000003' }]);

    await runDeliveryMigration('down');
    await expect(
      dataSource.query(
        `SELECT event_id FROM tbl_outbox_event ORDER BY event_id`,
      ),
    ).resolves.toHaveLength(3);
  });

  it('enforces the lease pair and nonnegative attempts and has a pending index', async () => {
    await runDeliveryMigration('up');
    await dataSource.query(`
      INSERT INTO tbl_outbox_event
        (event_id, event_type, aggregate_type, aggregate_id, revision,
         occurred_at, payload)
      VALUES
        ('10000000-0000-4000-8000-000000000001', 'listing.published.v1',
         'listing', '20000000-0000-4000-8000-000000000001', 1, NOW(), '{}')
    `);

    await expect(
      dataSource.query(`
        UPDATE tbl_outbox_delivery SET attempt_count = -1
        WHERE event_id = '10000000-0000-4000-8000-000000000001'
      `),
    ).rejects.toThrow();
    await expect(
      dataSource.query(`
        UPDATE tbl_outbox_delivery SET lease_owner = 'worker'
        WHERE event_id = '10000000-0000-4000-8000-000000000001'
      `),
    ).rejects.toThrow();
    await expect(
      dataSource.query(`
        SELECT indexname FROM pg_indexes
        WHERE tablename = 'tbl_outbox_delivery'
          AND indexname = 'idx_outbox_delivery_pending'
      `),
    ).resolves.toEqual([{ indexname: 'idx_outbox_delivery_pending' }]);
  });
});
