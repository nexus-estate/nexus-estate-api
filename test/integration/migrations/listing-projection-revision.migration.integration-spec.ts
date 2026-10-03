import {
  PostgreSqlContainer,
  type StartedPostgreSqlContainer,
} from '@testcontainers/postgresql';
import { DataSource } from 'typeorm';
import type { PostgresConnectionOptions } from 'typeorm/driver/postgres/PostgresConnectionOptions';

import { typeOrmConfig } from '../../../src/database/type.config';
import { AddListingProjectionRevision1791017550218 } from '../../../src/modules/listing/listing/migrations/1791017550218-AddListingProjectionRevision';

jest.setTimeout(120_000);

describe('Listing projection revision migration (PostgreSQL integration)', () => {
  let container: StartedPostgreSqlContainer;
  let dataSource: DataSource;

  beforeAll(async () => {
    container = await new PostgreSqlContainer('postgres:18-alpine')
      .withDatabase('nexus_estate_listing_revision_migration_test')
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
    await dataSource.query('DROP TABLE IF EXISTS tbl_listing CASCADE');
    await dataSource.query('DROP TYPE IF EXISTS listing_status_enum CASCADE');
    await dataSource.query(
      `CREATE TYPE listing_status_enum AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED')`,
    );
    await dataSource.query(`
      CREATE TABLE tbl_listing (
        id uuid PRIMARY KEY,
        status listing_status_enum NOT NULL
      )
    `);
    await dataSource.query(`
      INSERT INTO tbl_listing (id, status) VALUES
        ('10000000-0000-4000-8000-000000000001', 'DRAFT'),
        ('10000000-0000-4000-8000-000000000002', 'PUBLISHED'),
        ('10000000-0000-4000-8000-000000000003', 'ARCHIVED')
    `);
  });

  const runMigration = async (direction: 'up' | 'down'): Promise<void> => {
    const queryRunner = dataSource.createQueryRunner();
    await queryRunner.connect();
    try {
      const migration = new AddListingProjectionRevision1791017550218();
      await migration[direction](queryRunner);
    } finally {
      await queryRunner.release();
    }
  };

  it('adds a non-null bigint default, baselines every status, and rolls back cleanly', async () => {
    await runMigration('up');

    await expect(
      dataSource.query(`
        SELECT data_type, is_nullable, column_default
        FROM information_schema.columns
        WHERE table_name = 'tbl_listing' AND column_name = 'projection_revision'
      `),
    ).resolves.toEqual([
      {
        data_type: 'bigint',
        is_nullable: 'NO',
        column_default: '1',
      },
    ]);
    await expect(
      dataSource.query(
        'SELECT status, projection_revision::text FROM tbl_listing ORDER BY status',
      ),
    ).resolves.toEqual([
      { status: 'DRAFT', projection_revision: '1' },
      { status: 'PUBLISHED', projection_revision: '1' },
      { status: 'ARCHIVED', projection_revision: '1' },
    ]);

    await expect(
      dataSource.query(
        'SELECT conname FROM pg_constraint WHERE conrelid = $1::regclass AND conname = $2',
        ['tbl_listing', 'chk_listing_projection_revision_positive'],
      ),
    ).resolves.toEqual([
      { conname: 'chk_listing_projection_revision_positive' },
    ]);

    await runMigration('down');
    await expect(
      dataSource.query(`
        SELECT column_name
        FROM information_schema.columns
        WHERE table_name = 'tbl_listing' AND column_name = 'projection_revision'
      `),
    ).resolves.toEqual([]);
    await expect(
      dataSource.query(
        `SELECT conname FROM pg_constraint
         WHERE conrelid = 'tbl_listing'::regclass
           AND conname = 'chk_listing_projection_revision_positive'`,
      ),
    ).resolves.toEqual([]);
  });

  it('rejects zero and negative revisions while accepting the signed int64 maximum', async () => {
    await runMigration('up');

    await expect(
      dataSource.query(
        `UPDATE tbl_listing SET projection_revision = 0
         WHERE id = '10000000-0000-4000-8000-000000000001'`,
      ),
    ).rejects.toThrow();
    await expect(
      dataSource.query(
        `UPDATE tbl_listing SET projection_revision = -1
         WHERE id = '10000000-0000-4000-8000-000000000001'`,
      ),
    ).rejects.toThrow();
    await expect(
      dataSource.query(`
        UPDATE tbl_listing
        SET projection_revision = '9223372036854775807'::bigint
        WHERE id = '10000000-0000-4000-8000-000000000001'
      `),
    ).resolves.toBeDefined();
  });
});
