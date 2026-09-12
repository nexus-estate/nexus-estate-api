import {
  PostgreSqlContainer,
  type StartedPostgreSqlContainer,
} from '@testcontainers/postgresql';
import { DataSource } from 'typeorm';
import type { PostgresConnectionOptions } from 'typeorm/driver/postgres/PostgresConnectionOptions';

import { assertAllMigrationsApplied } from '../../../src/database/migration-runner/helpers';
import { typeOrmConfig } from '../../../src/database/type.config';
import { MigrateLegacyUserSchemaToCustomerAccount1789000000000 } from '../../../src/database/migrations/platform/1789000000000-MigrateLegacyUserSchemaToCustomerAccount';
import { backfillLegacyEstateProviders } from '../../../src/modules/provider/registration/data-migrations/backfill-legacy-estate-providers';

jest.setTimeout(120_000);

type CustomerRow = {
  id: string;
  email: string;
  password: string;
  role_id: string;
  created_at: Date;
  created_at_text: string;
};
type EstateOwnerRow = { fk_customer_id: string };
type ForeignKeyRow = { conname: string; definition: string };
type TableNameRow = { table_name: string | null };
type DiscoveredMigration = { name: string; timestamp: number };

function migrationName(migration: object): string {
  const namedMigration = migration as object & { name?: string };
  return namedMigration.name ?? migration.constructor.name;
}

describe('legacy User -> CustomerAccount schema upgrade', () => {
  let container: StartedPostgreSqlContainer;
  let dataSource: DataSource;

  beforeAll(async () => {
    container = await new PostgreSqlContainer('postgres:18-alpine')
      .withDatabase('nexus_estate_upgrade_test')
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
  });

  afterAll(async () => {
    await dataSource?.destroy();
    await container?.stop();
  });

  beforeEach(async () => {
    await dataSource.query('DROP SCHEMA public CASCADE');
    await dataSource.query('CREATE SCHEMA public');

    await dataSource.query(`
      CREATE TABLE tbl_role (
        id uuid PRIMARY KEY,
        name varchar NOT NULL
      )
    `);
    await dataSource.query(`
      CREATE TABLE tbl_user (
        id uuid PRIMARY KEY,
        email varchar NOT NULL,
        password varchar NOT NULL,
        role_id uuid NOT NULL,
        CONSTRAINT fk_user_role FOREIGN KEY (role_id) REFERENCES tbl_role(id)
      )
    `);
    await dataSource.query(`
      CREATE TABLE tbl_estate (
        id uuid PRIMARY KEY,
        fk_user_id uuid NOT NULL,
        CONSTRAINT fk_estate_user_id FOREIGN KEY (fk_user_id) REFERENCES tbl_user(id)
      )
    `);

    await dataSource.query(
      `INSERT INTO tbl_role (id, name) VALUES ('10000000-0000-4000-8000-000000000001', 'customer')`,
    );
    await dataSource.query(
      `INSERT INTO tbl_user (id, email, password, role_id) VALUES ('20000000-0000-4000-8000-000000000001', 'legacy@nexus.test', 'hash', '10000000-0000-4000-8000-000000000001')`,
    );
    await dataSource.query(
      `INSERT INTO tbl_estate (id, fk_user_id) VALUES ('30000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001')`,
    );
  });

  it('upgrades a legacy deployment through the current migration runner', async () => {
    await dataSource.query('DROP SCHEMA public CASCADE');
    await dataSource.query('CREATE SCHEMA public');
    await dataSource.query('CREATE EXTENSION IF NOT EXISTS pgcrypto');
    await dataSource.query(`
      CREATE TABLE tbl_role (
        id uuid PRIMARY KEY,
        name varchar NOT NULL UNIQUE,
        description text,
        is_system boolean NOT NULL DEFAULT false,
        created_at timestamp NOT NULL DEFAULT now(),
        updated_at timestamp NOT NULL DEFAULT now(),
        deleted_at timestamp,
        created_by varchar,
        updated_by varchar
      )
    `);
    await dataSource.query(`
      CREATE TABLE tbl_permission (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        name varchar NOT NULL UNIQUE,
        description text
      )
    `);
    await dataSource.query(`
      CREATE TABLE tbl_role_permissions (
        role_id uuid NOT NULL,
        permission_id uuid NOT NULL,
        PRIMARY KEY (role_id, permission_id),
        CONSTRAINT fk_role_permissions_role FOREIGN KEY (role_id) REFERENCES tbl_role(id) ON DELETE CASCADE,
        CONSTRAINT fk_role_permissions_permission FOREIGN KEY (permission_id) REFERENCES tbl_permission(id) ON DELETE CASCADE
      )
    `);
    await dataSource.query(`
      INSERT INTO tbl_role (id, name, description) VALUES
        ('10000000-0000-4000-8000-000000000001', 'admin', 'Legacy administrator'),
        ('10000000-0000-4000-8000-000000000002', 'broker', 'Legacy broker'),
        ('10000000-0000-4000-8000-000000000003', 'customer', 'Legacy customer')
    `);
    await dataSource.query(`
      CREATE TABLE tbl_user (
        id uuid PRIMARY KEY,
        email varchar NOT NULL UNIQUE,
        password varchar NOT NULL,
        role_id uuid NOT NULL,
        is_email_verified boolean NOT NULL DEFAULT false,
        last_login timestamp,
        created_at timestamp NOT NULL,
        updated_at timestamp NOT NULL,
        deleted_at timestamp,
        created_by varchar,
        updated_by varchar,
        CONSTRAINT fk_user_role FOREIGN KEY (role_id) REFERENCES tbl_role(id) ON DELETE RESTRICT
      )
    `);
    await dataSource.query(`
      CREATE TABLE tbl_province (
        id uuid PRIMARY KEY,
        name varchar(100) NOT NULL,
        code varchar(2) NOT NULL UNIQUE,
        type varchar(20) NOT NULL
      )
    `);
    await dataSource.query(`
      CREATE TABLE tbl_ward (
        id uuid PRIMARY KEY,
        name varchar(100) NOT NULL,
        code varchar(5) NOT NULL UNIQUE,
        type varchar(20) NOT NULL,
        fk_province_id uuid NOT NULL,
        CONSTRAINT fk_ward_province_id FOREIGN KEY (fk_province_id) REFERENCES tbl_province(id) ON DELETE RESTRICT
      )
    `);
    await dataSource.query(`
      CREATE TYPE tbl_estate_type_enum AS ENUM ('APARTMENT', 'HOUSE', 'VILLA', 'TOWNHOUSE', 'LAND', 'OFFICE', 'SHOPHOUSE', 'WAREHOUSE', 'COMMERCIAL', 'HOTEL', 'RESORT', 'FARM', 'OTHER');
      CREATE TYPE tbl_estate_purpose_enum AS ENUM ('SALE', 'RENT', 'SALE_OR_RENT');
      CREATE TABLE tbl_estate (
        id uuid PRIMARY KEY,
        created_at timestamptz NOT NULL,
        updated_at timestamptz NOT NULL,
        deleted_at timestamptz,
        created_by uuid,
        updated_by uuid,
        status varchar NOT NULL DEFAULT 'pending',
        approved_by uuid,
        approved_date timestamptz,
        rejected_by uuid,
        rejected_date timestamptz,
        rejection_reason text,
        fk_user_id uuid NOT NULL,
        address_line varchar(500) NOT NULL,
        title varchar(500) NOT NULL,
        price bigint NOT NULL,
        type tbl_estate_type_enum NOT NULL,
        purpose tbl_estate_purpose_enum NOT NULL,
        description text,
        area decimal(10,2),
        bedrooms int,
        bathrooms int,
        floors int,
        latitude decimal(10,7),
        longitude decimal(10,7),
        features json,
        start_date timestamptz,
        end_date timestamptz,
        is_featured boolean NOT NULL DEFAULT false,
        fk_province_id uuid NOT NULL,
        fk_ward_id uuid NOT NULL,
        CONSTRAINT fk_estate_user_id FOREIGN KEY (fk_user_id) REFERENCES tbl_user(id) ON DELETE RESTRICT,
        CONSTRAINT fk_estate_province_id FOREIGN KEY (fk_province_id) REFERENCES tbl_province(id) ON DELETE RESTRICT,
        CONSTRAINT fk_estate_ward_id FOREIGN KEY (fk_ward_id) REFERENCES tbl_ward(id) ON DELETE RESTRICT
      )
    `);
    await dataSource.query(`
      CREATE TABLE tbl_data_pool (
        id uuid PRIMARY KEY,
        user_id uuid NOT NULL,
        key varchar NOT NULL,
        value jsonb
      )
    `);
    const createdAt = '2026-09-01 10:00:00+07';
    await dataSource.query(
      `INSERT INTO tbl_user (id, email, password, role_id, created_at, updated_at) VALUES ($1, 'legacy-owner@nexus.test', 'legacy-hash', $2, $3, $3)`,
      [
        '20000000-0000-4000-8000-000000000001',
        '10000000-0000-4000-8000-000000000003',
        createdAt,
      ],
    );
    await dataSource.query(
      `INSERT INTO tbl_province (id, name, code, type) VALUES ('40000000-0000-4000-8000-000000000001', 'Legacy Province', '98', 'province')`,
    );
    await dataSource.query(
      `INSERT INTO tbl_ward (id, name, code, type, fk_province_id) VALUES ('50000000-0000-4000-8000-000000000001', 'Legacy Ward', '98001', 'ward', '40000000-0000-4000-8000-000000000001')`,
    );
    await dataSource.query(
      `INSERT INTO tbl_estate (id, created_at, updated_at, fk_user_id, address_line, title, price, type, purpose, fk_province_id, fk_ward_id) VALUES ('30000000-0000-4000-8000-000000000001', $1, $1, '20000000-0000-4000-8000-000000000001', 'Legacy address', 'Legacy estate', 100000, 'HOUSE', 'SALE', '40000000-0000-4000-8000-000000000001', '50000000-0000-4000-8000-000000000001')`,
      [createdAt],
    );

    await dataSource.query(`
      CREATE TABLE migrations (
        id serial PRIMARY KEY,
        timestamp bigint NOT NULL,
        name varchar NOT NULL
      )
    `);

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
    const upgradeDataSource = new DataSource(migrationOptions);
    await upgradeDataSource.initialize();
    try {
      const bridgeTimestamp = 1789000000000;
      const discoveredMigrations: DiscoveredMigration[] =
        upgradeDataSource.migrations.map((migration) => {
          const name = migrationName(migration);
          const timestamp = Number(name.match(/(\d{13})$/)?.[1] ?? 0);
          return { name, timestamp };
        });
      const legacyMigrations = discoveredMigrations
        .filter((migration) => migration.timestamp < bridgeTimestamp)
        .sort((left, right) => left.timestamp - right.timestamp);
      const legacyNames = legacyMigrations.map((migration) => migration.name);

      expect(legacyNames).toEqual(
        expect.arrayContaining([
          'CreateUserTable1741614400000',
          'AddUsernameToUserTable1741614700000',
          'AddFullNameToUserTable1741614800000',
          'RemoveFullNameFromUserTable1741614900000',
        ]),
      );

      for (const migration of legacyMigrations) {
        await upgradeDataSource.query(
          'INSERT INTO migrations (timestamp, name) VALUES ($1, $2)',
          [migration.timestamp, migration.name],
        );
      }

      const executedMigrations = await upgradeDataSource.runMigrations();
      expect(executedMigrations.map(migrationName)).toContain(
        'MigrateLegacyUserSchemaToCustomerAccount1789000000000',
      );
      expect(executedMigrations.map(migrationName)).not.toContain(
        'CreateUserTable1741614400000',
      );
      await expect(upgradeDataSource.showMigrations()).resolves.toBe(false);
      await assertAllMigrationsApplied(upgradeDataSource);

      const customer = await upgradeDataSource.query<CustomerRow[]>(
        `SELECT id, email, password, role_id, created_at, to_char(created_at, 'YYYY-MM-DD HH24:MI:SS') AS created_at_text FROM tbl_customer_account`,
      );
      expect(customer).toEqual([
        expect.objectContaining({
          id: '20000000-0000-4000-8000-000000000001',
          email: 'legacy-owner@nexus.test',
          password: 'legacy-hash',
          role_id: '10000000-0000-4000-8000-000000000003',
          created_at_text: '2026-09-01 10:00:00',
        }),
      ]);

      const estate = await upgradeDataSource.query<EstateOwnerRow[]>(
        `SELECT fk_customer_id FROM tbl_estate WHERE id = '30000000-0000-4000-8000-000000000001'`,
      );
      expect(estate).toEqual([
        { fk_customer_id: '20000000-0000-4000-8000-000000000001' },
      ]);
      const foreignKeys = await upgradeDataSource.query<ForeignKeyRow[]>(
        `SELECT conname, pg_get_constraintdef(oid) AS definition FROM pg_constraint WHERE conrelid IN ('tbl_customer_account'::regclass, 'tbl_estate'::regclass) AND contype = 'f'`,
      );
      const roleReference = expect.stringContaining(
        'REFERENCES tbl_role(id)',
      ) as unknown as string;
      const customerReference = expect.stringContaining(
        'REFERENCES tbl_customer_account(id)',
      ) as unknown as string;
      expect(foreignKeys).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            conname: 'fk_customer_account_role',
            definition: roleReference,
          }),
          expect.objectContaining({
            definition: customerReference,
          }),
        ]),
      );
      await expect(
        upgradeDataSource.query<{ orphan_count: number }[]>(
          `SELECT COUNT(*)::int AS orphan_count FROM tbl_estate e LEFT JOIN tbl_customer_account c ON c.id = e.fk_customer_id WHERE c.id IS NULL`,
        ),
      ).resolves.toEqual([{ orphan_count: 0 }]);

      await expect(
        upgradeDataSource.query<TableNameRow[]>(
          `SELECT to_regclass('tbl_user') AS table_name`,
        ),
      ).resolves.toEqual([{ table_name: null }]);
      await expect(
        upgradeDataSource.query<TableNameRow[]>(
          `SELECT to_regclass('tbl_customer_account') AS table_name`,
        ),
      ).resolves.toEqual([{ table_name: 'tbl_customer_account' }]);

      await expect(
        backfillLegacyEstateProviders(upgradeDataSource),
      ).resolves.toBe(1);
      await expect(
        backfillLegacyEstateProviders(upgradeDataSource),
      ).resolves.toBe(0);
      await expect(
        upgradeDataSource.query(
          `SELECT owner_customer_id, status, verification_status FROM tbl_provider_account`,
        ),
      ).resolves.toEqual([
        {
          owner_customer_id: '20000000-0000-4000-8000-000000000001',
          status: 'ACTIVE',
          verification_status: 'VERIFIED',
        },
      ]);
    } finally {
      await upgradeDataSource.destroy();
    }
  });

  it('renames legacy identity and estate ownership without losing data', async () => {
    const queryRunner = dataSource.createQueryRunner();
    await queryRunner.connect();
    try {
      await new MigrateLegacyUserSchemaToCustomerAccount1789000000000().up(
        queryRunner,
      );
    } finally {
      await queryRunner.release();
    }

    expect(
      await dataSource.query(`SELECT to_regclass('tbl_user') AS table_name`),
    ).toEqual([{ table_name: null }]);
    expect(
      await dataSource.query(
        `SELECT to_regclass('tbl_customer_account') AS table_name`,
      ),
    ).toEqual([{ table_name: 'tbl_customer_account' }]);

    const customers = await dataSource.query<
      Array<{ id: string; email: string }>
    >('SELECT id, email FROM tbl_customer_account');
    expect(customers).toEqual([
      {
        id: '20000000-0000-4000-8000-000000000001',
        email: 'legacy@nexus.test',
      },
    ]);

    const estateColumns = await dataSource.query<
      Array<{ column_name: string }>
    >(
      `SELECT column_name FROM information_schema.columns WHERE table_name = 'tbl_estate'`,
    );
    expect(estateColumns.map((column) => column.column_name)).toContain(
      'fk_customer_id',
    );
    expect(estateColumns.map((column) => column.column_name)).not.toContain(
      'fk_user_id',
    );

    const estates = await dataSource.query<Array<{ fk_customer_id: string }>>(
      'SELECT fk_customer_id FROM tbl_estate',
    );
    expect(estates).toEqual([
      { fk_customer_id: '20000000-0000-4000-8000-000000000001' },
    ]);

    const constraints = await dataSource.query<Array<{ conname: string }>>(`
      SELECT conname
      FROM pg_constraint
      WHERE conrelid = 'tbl_customer_account'::regclass
    `);
    expect(constraints.map((constraint) => constraint.conname)).toContain(
      'fk_customer_account_role',
    );
  });

  it('is a no-op when the database already uses the CustomerAccount schema', async () => {
    await dataSource.query('DROP TABLE tbl_estate CASCADE');
    await dataSource.query(
      'ALTER TABLE tbl_user RENAME TO tbl_customer_account',
    );

    const queryRunner = dataSource.createQueryRunner();
    await queryRunner.connect();
    try {
      await expect(
        new MigrateLegacyUserSchemaToCustomerAccount1789000000000().up(
          queryRunner,
        ),
      ).resolves.toBeUndefined();
    } finally {
      await queryRunner.release();
    }
  });
});
