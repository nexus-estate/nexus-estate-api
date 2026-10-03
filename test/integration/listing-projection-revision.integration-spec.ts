import {
  PostgreSqlContainer,
  type StartedPostgreSqlContainer,
} from '@testcontainers/postgresql';
import { DataSource } from 'typeorm';

import { ListingProjectionRevisionRepo } from '../../src/modules/listing/listing/repositories/listing-projection-revision.repo';

jest.setTimeout(120_000);

describe('Listing projection revision repository (PostgreSQL integration)', () => {
  let container: StartedPostgreSqlContainer;
  let dataSource: DataSource;
  let revisions: ListingProjectionRevisionRepo;

  const listingId = '10000000-0000-4000-8000-000000000001';
  const estateId = '20000000-0000-4000-8000-000000000001';

  beforeAll(async () => {
    container = await new PostgreSqlContainer('postgres:18-alpine')
      .withDatabase('nexus_estate_listing_revision_repo_test')
      .withUsername('test')
      .withPassword('test')
      .start();
    dataSource = new DataSource({
      type: 'postgres',
      host: container.getHost(),
      port: container.getMappedPort(5432),
      username: container.getUsername(),
      password: container.getPassword(),
      database: container.getDatabase(),
    });
    await dataSource.initialize();
    revisions = new ListingProjectionRevisionRepo();
    await dataSource.query(`
      CREATE TABLE tbl_listing (
        id uuid PRIMARY KEY,
        fk_estate_id uuid NOT NULL UNIQUE,
        projection_revision bigint NOT NULL DEFAULT 1
          CONSTRAINT chk_listing_projection_revision_positive CHECK (projection_revision >= 1),
        deleted_at timestamptz NULL,
        updated_at timestamptz NOT NULL DEFAULT NOW()
      )
    `);
  });

  beforeEach(async () => {
    await dataSource.query('TRUNCATE TABLE tbl_listing');
    await dataSource.query(
      `INSERT INTO tbl_listing (id, fk_estate_id, updated_at)
       VALUES ($1, $2, '2025-01-01T00:00:00.000Z')`,
      [listingId, estateId],
    );
  });

  afterAll(async () => {
    await dataSource?.destroy();
    await container?.stop();
  });

  it('increments atomically, returns the revision as a string, and leaves updated_at alone', async () => {
    const revision = await revisions.incrementProjectionRevision(
      listingId,
      dataSource.manager,
    );

    expect(revision).toBe('2');
    expect(typeof revision).toBe('string');
    await expect(
      dataSource.query(
        `SELECT updated_at::text FROM tbl_listing WHERE id = $1`,
        [listingId],
      ),
    ).resolves.toEqual([{ updated_at: '2025-01-01 00:00:00+00' }]);
  });

  it('increments the current listing by estate ID', async () => {
    await expect(
      revisions.incrementProjectionRevisionByEstateId(
        estateId,
        dataSource.manager,
      ),
    ).resolves.toBe('2');
  });

  it('returns null for missing or soft-deleted listings', async () => {
    await expect(
      revisions.incrementProjectionRevision(
        '30000000-0000-4000-8000-000000000001',
        dataSource.manager,
      ),
    ).resolves.toBeNull();
    await dataSource.query(
      'UPDATE tbl_listing SET deleted_at = NOW() WHERE id = $1',
      [listingId],
    );
    await expect(
      revisions.incrementProjectionRevisionByEstateId(
        estateId,
        dataSource.manager,
      ),
    ).resolves.toBeNull();
  });

  it('preserves precision above JavaScript safe integers', async () => {
    await dataSource.query(
      `UPDATE tbl_listing SET projection_revision = '9007199254740992'::bigint`,
    );

    await expect(
      revisions.incrementProjectionRevision(listingId, dataSource.manager),
    ).resolves.toBe('9007199254740993');
  });

  it('rolls a revision increment back with its caller transaction', async () => {
    await expect(
      dataSource.transaction(async (manager) => {
        await revisions.incrementProjectionRevision(listingId, manager);
        throw new Error('rollback transaction');
      }),
    ).rejects.toThrow('rollback transaction');

    await expect(
      dataSource.query(
        'SELECT projection_revision::text FROM tbl_listing WHERE id = $1',
        [listingId],
      ),
    ).resolves.toEqual([{ projection_revision: '1' }]);
  });

  it('serializes twenty concurrent increments without losing or duplicating revisions', async () => {
    const returned = await Promise.all(
      Array.from({ length: 20 }, () =>
        dataSource.transaction((manager) =>
          revisions.incrementProjectionRevision(listingId, manager),
        ),
      ),
    );

    const returnedRevisions = returned as string[];
    expect(
      returnedRevisions.sort((left, right) => {
        const leftValue = BigInt(left);
        const rightValue = BigInt(right);
        return leftValue < rightValue ? -1 : leftValue > rightValue ? 1 : 0;
      }),
    ).toEqual(Array.from({ length: 20 }, (_, index) => String(index + 2)));
    await expect(
      dataSource.query(
        'SELECT projection_revision::text FROM tbl_listing WHERE id = $1',
        [listingId],
      ),
    ).resolves.toEqual([{ projection_revision: '21' }]);
  });

  it('rejects an increment past signed int64 maximum', async () => {
    await dataSource.query(
      `UPDATE tbl_listing SET projection_revision = '9223372036854775807'::bigint`,
    );

    await expect(
      revisions.incrementProjectionRevision(listingId, dataSource.manager),
    ).rejects.toThrow();
    await expect(
      dataSource.query(
        'SELECT projection_revision::text FROM tbl_listing WHERE id = $1',
        [listingId],
      ),
    ).resolves.toEqual([{ projection_revision: '9223372036854775807' }]);
  });
});
