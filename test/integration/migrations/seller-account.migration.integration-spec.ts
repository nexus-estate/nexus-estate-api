import {
  PostgreSqlContainer,
  type StartedPostgreSqlContainer,
} from '@testcontainers/postgresql';
import { DataSource } from 'typeorm';
import type { PostgresConnectionOptions } from 'typeorm/driver/postgres/PostgresConnectionOptions';

import { typeOrmConfig } from '../../../src/database/type.config';
import { backfillLegacyEstateSellers } from '../../../src/modules/seller-platform/account/data-migrations/backfill-legacy-estate-sellers';

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
      'owner_buyer_id',
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
    expect(indexByName.get('uq_seller_account_owner_buyer_id')).toContain(
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
      (foreignKey) => foreignKey.conname === 'fk_seller_account_owner_buyer',
    );
    expect(ownerForeignKey?.definition).toContain(
      'REFERENCES tbl_buyer_account(id)',
    );

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

  it('backfills legacy Estate sellers idempotently', async () => {
    const roleRows: CatalogRow[] = await dataSource.query(
      `SELECT id FROM tbl_role WHERE name = 'buyer'`,
    );
    const userRows: CatalogRow[] = await dataSource.query(
      `
        INSERT INTO tbl_buyer_account (email, password, role_id)
        VALUES ('backfill-seller@nexus.test', 'not-used', $1)
        RETURNING id
      `,
      [roleRows[0].id],
    );
    const provinceRows: CatalogRow[] = await dataSource.query(
      `
        INSERT INTO tbl_province (name, code, type)
        VALUES ('Backfill Province', '98', 'province')
        RETURNING id
      `,
    );
    const wardRows: CatalogRow[] = await dataSource.query(
      `
        INSERT INTO tbl_ward (name, code, type, fk_province_id)
        VALUES ('Backfill Ward', '98001', 'ward', $1)
        RETURNING id
      `,
      [provinceRows[0].id],
    );
    await dataSource.query(
      `
        INSERT INTO tbl_estate (
          fk_buyer_id,
          address_line,
          title,
          price,
          type,
          purpose,
          fk_province_id,
          fk_ward_id
        )
        VALUES ($1, 'Backfill address', 'Backfill estate', 100000, 'HOUSE', 'SALE', $2, $3)
      `,
      [userRows[0].id, provinceRows[0].id, wardRows[0].id],
    );

    const firstRun = await backfillLegacyEstateSellers(dataSource);
    const secondRun = await backfillLegacyEstateSellers(dataSource);
    const accountRows: CatalogRow[] = await dataSource.query(
      `SELECT id FROM tbl_seller_account WHERE owner_buyer_id = $1`,
      [userRows[0].id],
    );

    expect(firstRun).toBe(1);
    expect(secondRun).toBe(0);
    expect(accountRows).toHaveLength(1);
  });
});
