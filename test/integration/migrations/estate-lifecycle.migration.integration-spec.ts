import {
  PostgreSqlContainer,
  type StartedPostgreSqlContainer,
} from '@testcontainers/postgresql';
import { DataSource } from 'typeorm';
import type { PostgresConnectionOptions } from 'typeorm/driver/postgres/PostgresConnectionOptions';

import { typeOrmConfig } from '../../../src/database/type.config';
import { MigrateEstateStatusToLifecycle1790076216829 } from '../../../src/modules/estate/property/migrations/1790076216829-MigrateEstateStatusToLifecycle';

jest.setTimeout(120_000);

describe('Estate lifecycle migration (PostgreSQL integration)', () => {
  let container: StartedPostgreSqlContainer;
  let dataSource: DataSource;

  beforeAll(async () => {
    container = await new PostgreSqlContainer('postgres:18-alpine')
      .withDatabase('nexus_estate_lifecycle_migration_test')
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
    await dataSource.query('DROP TABLE IF EXISTS tbl_estate CASCADE');
    await dataSource.query('DROP TYPE IF EXISTS estate_status_enum CASCADE');
    await dataSource.query(
      'DROP TYPE IF EXISTS estate_lifecycle_status_enum CASCADE',
    );
    await dataSource.query(
      'DROP TYPE IF EXISTS estate_status_legacy_enum CASCADE',
    );
  });

  const createLegacySchema = async (includeUnmapped = false): Promise<void> => {
    const extraEnumValue = includeUnmapped ? ", 'unmapped'" : '';
    await dataSource.query(
      `CREATE TYPE estate_status_enum AS ENUM ('pending', 'approved', 'rejected'${extraEnumValue})`,
    );
    await dataSource.query(`
      CREATE TABLE tbl_estate (
        id uuid PRIMARY KEY,
        status estate_status_enum NOT NULL DEFAULT 'pending'
      )
    `);
  };

  const runMigration = async (direction: 'up' | 'down'): Promise<void> => {
    const queryRunner = dataSource.createQueryRunner();
    await queryRunner.connect();
    try {
      const migration = new MigrateEstateStatusToLifecycle1790076216829();
      await migration[direction](queryRunner);
    } finally {
      await queryRunner.release();
    }
  };

  it('maps every legacy status and defines the lifecycle contract', async () => {
    await createLegacySchema();
    await dataSource.query(`
      INSERT INTO tbl_estate (id, status) VALUES
        ('10000000-0000-4000-8000-000000000001', 'pending'),
        ('10000000-0000-4000-8000-000000000002', 'approved'),
        ('10000000-0000-4000-8000-000000000003', 'rejected')
    `);

    await runMigration('up');

    await expect(
      dataSource.query('SELECT id::text, status FROM tbl_estate ORDER BY id'),
    ).resolves.toEqual([
      {
        id: '10000000-0000-4000-8000-000000000001',
        status: 'DRAFT',
      },
      {
        id: '10000000-0000-4000-8000-000000000002',
        status: 'ACTIVE',
      },
      {
        id: '10000000-0000-4000-8000-000000000003',
        status: 'ARCHIVED',
      },
    ]);

    await expect(
      dataSource.query(
        `SELECT is_nullable, column_default
         FROM information_schema.columns
         WHERE table_name = 'tbl_estate' AND column_name = 'status'`,
      ),
    ).resolves.toEqual([
      {
        is_nullable: 'NO',
        column_default: "'DRAFT'::estate_status_enum",
      },
    ]);
    await expect(
      dataSource.query(
        `SELECT enumlabel FROM pg_enum
         INNER JOIN pg_type ON pg_type.oid = pg_enum.enumtypid
         WHERE pg_type.typname = 'estate_status_enum'
         ORDER BY enumsortorder`,
      ),
    ).resolves.toEqual([
      { enumlabel: 'DRAFT' },
      { enumlabel: 'ACTIVE' },
      { enumlabel: 'ARCHIVED' },
    ]);

    await runMigration('down');
    await expect(
      dataSource.query('SELECT id::text, status FROM tbl_estate ORDER BY id'),
    ).resolves.toEqual([
      {
        id: '10000000-0000-4000-8000-000000000001',
        status: 'pending',
      },
      {
        id: '10000000-0000-4000-8000-000000000002',
        status: 'approved',
      },
      {
        id: '10000000-0000-4000-8000-000000000003',
        status: 'rejected',
      },
    ]);
  });

  it('fails before contract when an unmapped legacy value exists', async () => {
    await createLegacySchema(true);
    await dataSource.query(`
      INSERT INTO tbl_estate (id, status)
      VALUES ('10000000-0000-4000-8000-000000000004', 'unmapped')
    `);

    await expect(runMigration('up')).rejects.toThrow(
      'Cannot migrate tbl_estate.status: unmapped legacy status exists',
    );
  });
});
