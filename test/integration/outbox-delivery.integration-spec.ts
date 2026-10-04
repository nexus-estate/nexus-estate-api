import {
  PostgreSqlContainer,
  type StartedPostgreSqlContainer,
} from '@testcontainers/postgresql';
import { DataSource } from 'typeorm';
import type { PostgresConnectionOptions } from 'typeorm/driver/postgres/PostgresConnectionOptions';

import { typeOrmConfig } from '../../src/database/type.config';
import { CreateOutboxEventTable1791023416144 } from '../../src/modules/eventing/outbox/migrations/1791023416144-CreateOutboxEventTable';
import { CreateOutboxDeliveryTable1791094051668 } from '../../src/modules/eventing/outbox/migrations/1791094051668-CreateOutboxDeliveryTable';
import { OutboxDeliveryRepo } from '../../src/modules/eventing/outbox/repositories/outbox-delivery.repo';

jest.setTimeout(120_000);

describe('OutboxDeliveryRepo (PostgreSQL 18 integration)', () => {
  let container: StartedPostgreSqlContainer;
  let dataSource: DataSource;
  let repository: OutboxDeliveryRepo;

  beforeAll(async () => {
    container = await new PostgreSqlContainer('postgres:18-alpine')
      .withDatabase('nexus_estate_outbox_delivery_test')
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
    repository = new OutboxDeliveryRepo(dataSource);
    await runMigration(
      dataSource,
      new CreateOutboxEventTable1791023416144(),
      'up',
    );
    await runMigration(
      dataSource,
      new CreateOutboxDeliveryTable1791094051668(),
      'up',
    );
  });

  afterAll(async () => {
    await dataSource?.destroy();
    await container?.stop();
  });

  beforeEach(async () => {
    await dataSource.query(
      'TRUNCATE TABLE tbl_outbox_delivery, tbl_outbox_event',
    );
  });

  it('allows only one concurrent lease for an event', async () => {
    await insertEvent('10000000-0000-4000-8000-000000000001', LISTING_A, 1);

    const [first, second] = await Promise.all([
      repository.claimBatch('publisher-a', 1, 10_000),
      repository.claimBatch('publisher-b', 1, 10_000),
    ]);

    expect(first.length + second.length).toBe(1);
    const owner = first.length ? 'publisher-a' : 'publisher-b';
    await expect(
      dataSource.query(
        'SELECT lease_owner FROM tbl_outbox_delivery WHERE event_id = $1',
        ['10000000-0000-4000-8000-000000000001'],
      ),
    ).resolves.toEqual([{ lease_owner: owner }]);
  });

  it('recovers an expired lease and fences the former owner', async () => {
    await insertEvent('10000000-0000-4000-8000-000000000001', LISTING_A, 1);
    const first = await repository.claimBatch('publisher-a', 1, 50);
    expect(first[0].attemptCount).toBe(1);
    await new Promise((resolve) => setTimeout(resolve, 100));

    const recovered = await repository.claimBatch('publisher-b', 1, 10_000);
    expect(recovered).toHaveLength(1);
    expect(recovered[0]).toMatchObject({
      attemptCount: 2,
      leaseExpired: true,
      envelope: {
        eventId: '10000000-0000-4000-8000-000000000001',
        revision: '1',
        payload: { deleted: false, document: { title: 'Revision 1' } },
      },
    });
    await expect(
      repository.markDelivered(
        '10000000-0000-4000-8000-000000000001',
        'publisher-a',
      ),
    ).resolves.toBe(false);
    await expect(
      repository.markDelivered(
        '10000000-0000-4000-8000-000000000001',
        'publisher-b',
      ),
    ).resolves.toBe(true);
    await expect(
      repository.claimBatch('publisher-c', 10, 10_000),
    ).resolves.toHaveLength(0);
  });

  it('claims only each aggregate head and unlocks its next revision after ACK', async () => {
    await insertEvent('10000000-0000-4000-8000-000000000001', LISTING_A, 1);
    await insertEvent('10000000-0000-4000-8000-000000000002', LISTING_A, 2);
    await insertEvent('10000000-0000-4000-8000-000000000003', LISTING_A, 3);
    await insertEvent('10000000-0000-4000-8000-000000000004', LISTING_B, 1);

    const initial = await repository.claimBatch('publisher-a', 10, 10_000);
    expect(
      initial.map(({ envelope }) => [envelope.aggregateId, envelope.revision]),
    ).toEqual(
      expect.arrayContaining([
        [LISTING_A, '1'],
        [LISTING_B, '1'],
      ]),
    );
    expect(initial).toHaveLength(2);

    await repository.markDelivered(
      '10000000-0000-4000-8000-000000000001',
      'publisher-a',
    );
    const next = await repository.claimBatch('publisher-b', 10, 10_000);
    expect(next.map(({ envelope }) => envelope.revision)).toEqual(['2']);
    expect(next[0].envelope.aggregateId).toBe(LISTING_A);
  });

  it('persists retry time and exposes current backlog age/count', async () => {
    await insertEvent('10000000-0000-4000-8000-000000000001', LISTING_A, 1);
    const [claimed] = await repository.claimBatch('publisher-a', 1, 10_000);
    await expect(
      repository.scheduleRetry(
        claimed.envelope.eventId,
        'publisher-a',
        60_000,
        'KAFKA_TIMEOUT',
        'broker did not acknowledge',
      ),
    ).resolves.toBe(true);
    await expect(repository.getBacklogStats()).resolves.toMatchObject({
      pendingTotal: '1',
    });
    await expect(
      dataSource.query(
        `SELECT lease_owner, leased_until, last_error_code, last_error_message
         FROM tbl_outbox_delivery WHERE event_id = $1`,
        [claimed.envelope.eventId],
      ),
    ).resolves.toEqual([
      {
        lease_owner: null,
        leased_until: null,
        last_error_code: 'KAFKA_TIMEOUT',
        last_error_message: 'broker did not acknowledge',
      },
    ]);
    await expect(
      repository.claimBatch('publisher-b', 1, 10_000),
    ).resolves.toHaveLength(0);
  });

  it('uses the partial pending index for a sparse due backlog', async () => {
    await dataSource.query(`
      INSERT INTO tbl_outbox_event
        (event_id, event_type, aggregate_type, aggregate_id, revision,
         occurred_at, payload)
      SELECT
        ('10000000-0000-4000-8000-' || LPAD(n::text, 12, '0'))::uuid,
        'listing.published.v1', 'listing',
        ('20000000-0000-4000-8000-' || LPAD(n::text, 12, '0'))::uuid,
        1, NOW(), '{}'
      FROM generate_series(1, 5000) AS n
    `);
    await dataSource.query(`
      UPDATE tbl_outbox_delivery
      SET next_attempt_at = NOW() + INTERVAL '1 day'
      WHERE event_id > '10000000-0000-4000-8000-000000000100'
    `);
    await dataSource.query('ANALYZE tbl_outbox_delivery');
    await dataSource.query('ANALYZE tbl_outbox_event');

    const plan: unknown = await dataSource.query(`
      EXPLAIN (ANALYZE, BUFFERS, COSTS OFF)
      SELECT d.event_id
      FROM tbl_outbox_delivery d
      JOIN tbl_outbox_event e ON e.event_id = d.event_id
      WHERE d.delivered_at IS NULL
        AND d.next_attempt_at <= NOW()
        AND (d.leased_until IS NULL OR d.leased_until <= NOW())
        AND NOT EXISTS (
          SELECT 1
          FROM tbl_outbox_delivery older_d
          JOIN tbl_outbox_event older_e ON older_e.event_id = older_d.event_id
          WHERE older_e.aggregate_type = e.aggregate_type
            AND older_e.aggregate_id = e.aggregate_id
            AND (
              older_e.revision < e.revision
              OR (
                older_e.revision = e.revision
                AND (older_e.created_at, older_e.event_id) <
                    (e.created_at, e.event_id)
              )
            )
            AND older_d.delivered_at IS NULL
        )
      ORDER BY e.created_at, e.event_id
      LIMIT 25
    `);
    expect(JSON.stringify(plan)).toContain('idx_outbox_delivery_pending');
  });

  async function insertEvent(
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
});

async function runMigration(
  dataSource: DataSource,
  migration: { up(queryRunner: import('typeorm').QueryRunner): Promise<void> },
  direction: 'up',
): Promise<void> {
  const runner = dataSource.createQueryRunner();
  await runner.connect();
  try {
    await migration[direction](runner);
  } finally {
    await runner.release();
  }
}

const LISTING_A = '20000000-0000-4000-8000-000000000001';
const LISTING_B = '20000000-0000-4000-8000-000000000002';
