import {
  PostgreSqlContainer,
  type StartedPostgreSqlContainer,
} from '@testcontainers/postgresql';
import { DataSource } from 'typeorm';
import type { PostgresConnectionOptions } from 'typeorm/driver/postgres/PostgresConnectionOptions';

import { typeOrmConfig } from '../../../src/database/type.config';

jest.setTimeout(120_000);

type CatalogRow = Record<string, string | null>;

describe('SellerAccount migration (PostgreSQL integration)', () => {
  let container: StartedPostgreSqlContainer;
  let dataSource: DataSource;

  beforeAll(async () => {
    container = await new PostgreSqlContainer('postgres:18-alpine')
      .withDatabase('nexus_estate_migration_test')
      .withUsername('test')
      .withPassword('test')
      .start();

    const migrationOptions: PostgresConnectionOptions = {
      ...(typeOrmConfig as PostgresConnectionOptions),
      type: 'postgres',
      host: container.getHost(),
      port: container.getMappedPort(5432),
      username: container.getUsername(),
      password: container.getPassword(),
      database: container.getDatabase(),
      entities: [],
    };
    dataSource = new DataSource(migrationOptions);
    await dataSource.initialize();
    await dataSource.runMigrations();
  });

  afterAll(async () => {
    await dataSource?.destroy();
    await container?.stop();
  });

  it('discovers the module-owned migration exactly once', () => {
    const migrationNames = dataSource.migrations.map(
      (migration) => migration.constructor.name,
    );

    expect(
      migrationNames.filter((name) => name.endsWith('1789202344037')),
    ).toHaveLength(1);
  });

  it('creates the SellerAccount persistence contract', async () => {
    const tableRows: CatalogRow[] = await dataSource.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = current_schema()
        AND table_name = 'tbl_seller_account'
    `);
    expect(tableRows).toHaveLength(1);

    const columns: CatalogRow[] = await dataSource.query(`
      SELECT column_name, udt_name
      FROM information_schema.columns
      WHERE table_schema = current_schema()
        AND table_name = 'tbl_seller_account'
    `);
    const columnByName = new Map(
      columns.map((column) => [column.column_name, column]),
    );

    for (const columnName of [
      'owner_user_id',
      'status',
      'type',
      'verification_status',
    ]) {
      expect(columnByName.has(columnName)).toBe(true);
    }
    for (const columnName of ['created_at', 'updated_at', 'deleted_at']) {
      expect(columnByName.get(columnName)?.udt_name).toBe('timestamp');
    }

    const indexes: CatalogRow[] = await dataSource.query(`
      SELECT indexname, indexdef
      FROM pg_indexes
      WHERE schemaname = current_schema()
        AND tablename = 'tbl_seller_account'
    `);
    const indexByName = new Map(
      indexes.map((index) => [index.indexname, index.indexdef]),
    );
    expect(indexByName.get('uq_seller_account_owner_user_id')).toContain(
      'UNIQUE',
    );
    expect(indexByName.has('idx_seller_account_status')).toBe(true);
    expect(indexByName.has('idx_seller_account_type')).toBe(true);

    const foreignKeys: CatalogRow[] = await dataSource.query(`
      SELECT conname, pg_get_constraintdef(oid) AS definition
      FROM pg_constraint
      WHERE conrelid = 'tbl_seller_account'::regclass
        AND contype = 'f'
    `);
    const ownerForeignKey = foreignKeys.find(
      (foreignKey) => foreignKey.conname === 'fk_seller_account_owner_user',
    );
    expect(ownerForeignKey?.definition).toContain('REFERENCES tbl_user(id)');

    const checkConstraints: CatalogRow[] = await dataSource.query(`
      SELECT conname, pg_get_constraintdef(oid) AS definition
      FROM pg_constraint
      WHERE conrelid = 'tbl_seller_account'::regclass
        AND contype = 'c'
    `);
    const checksByName = new Map(
      checkConstraints.map((constraint) => [
        constraint.conname,
        constraint.definition,
      ]),
    );
    expect(checksByName.get('chk_seller_account_type')).toEqual(
      expect.stringContaining('INDIVIDUAL'),
    );
    expect(checksByName.get('chk_seller_account_type')).toEqual(
      expect.stringContaining('BROKER'),
    );
    expect(checksByName.get('chk_seller_account_type')).toEqual(
      expect.stringContaining('AGENCY'),
    );
    expect(checksByName.get('chk_seller_account_status')).toEqual(
      expect.stringContaining('ACTIVE'),
    );
    expect(checksByName.get('chk_seller_account_status')).toEqual(
      expect.stringContaining('SUSPENDED'),
    );
    expect(checksByName.get('chk_seller_account_verification_status')).toEqual(
      expect.stringContaining('UNVERIFIED'),
    );
    expect(checksByName.get('chk_seller_account_verification_status')).toEqual(
      expect.stringContaining('PENDING'),
    );
    expect(checksByName.get('chk_seller_account_verification_status')).toEqual(
      expect.stringContaining('VERIFIED'),
    );
    expect(checksByName.get('chk_seller_account_verification_status')).toEqual(
      expect.stringContaining('REJECTED'),
    );
  });
});
