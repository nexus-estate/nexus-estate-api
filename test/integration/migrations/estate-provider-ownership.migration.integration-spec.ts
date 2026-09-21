import {
  PostgreSqlContainer,
  type StartedPostgreSqlContainer,
} from '@testcontainers/postgresql';
import { DataSource } from 'typeorm';
import type { PostgresConnectionOptions } from 'typeorm/driver/postgres/PostgresConnectionOptions';

import { typeOrmConfig } from '../../../src/database/type.config';
import { ContractEstateProviderOwnership1789584000000 } from '../../../src/modules/estate/property/migrations/1789584000000-ContractEstateProviderOwnership';

jest.setTimeout(120_000);

type CatalogRow = Record<string, string | null>;

const MIGRATION_NAME = 'ContractEstateProviderOwnership1789584000000';

describe('Estate provider ownership contract migration (PostgreSQL integration)', () => {
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

  const runContractUp = async (): Promise<void> => {
    const queryRunner = dataSource.createQueryRunner();
    await queryRunner.connect();
    try {
      await new ContractEstateProviderOwnership1789584000000().up(queryRunner);
    } finally {
      await queryRunner.release();
    }
  };

  const runContractDown = async (): Promise<void> => {
    const queryRunner = dataSource.createQueryRunner();
    await queryRunner.connect();
    try {
      await new ContractEstateProviderOwnership1789584000000().down(
        queryRunner,
      );
    } finally {
      await queryRunner.release();
    }
  };

  const estateNullability = async (
    columnName: string,
  ): Promise<string | null> => {
    const columns: CatalogRow[] = await dataSource.query(
      `SELECT is_nullable FROM information_schema.columns
       WHERE table_name = 'tbl_estate' AND column_name = $1`,
      [columnName],
    );
    return columns[0]?.is_nullable ?? null;
  };

  /** Seeds the minimum referenced rows and returns the customer id. */
  const seedEstateOwner = async (): Promise<string> => {
    const customerId = '20000000-0000-4000-8000-000000000001';
    await dataSource.query(
      `INSERT INTO tbl_role (id, name) VALUES ('10000000-0000-4000-8000-000000000001', 'customer')`,
    );
    await dataSource.query(
      `INSERT INTO tbl_customer_account (id, email, password, role_id)
       VALUES ($1, 'owner@nexus.test', 'hash', '10000000-0000-4000-8000-000000000001')`,
      [customerId],
    );
    await dataSource.query(
      `INSERT INTO tbl_province (id, code, name, type)
       VALUES ('30000000-0000-4000-8000-000000000001', '79', 'Ho Chi Minh City', 'MUNICIPALITY')`,
    );
    await dataSource.query(
      `INSERT INTO tbl_ward (id, code, name, type, fk_province_id)
       VALUES ('40000000-0000-4000-8000-000000000001', '26734', 'Ben Nghe', 'WARD', '30000000-0000-4000-8000-000000000001')`,
    );
    return customerId;
  };

  const insertEstateWithoutProvider = async (
    customerId: string,
  ): Promise<string> => {
    const estateId = '50000000-0000-4000-8000-000000000001';
    await dataSource.query(
      `INSERT INTO tbl_estate (id, fk_customer_id, fk_provider_id, title, price, type, purpose, address_line, fk_province_id, fk_ward_id)
       VALUES ($1, $2, NULL, 'Orphan estate', 1000000, 'APARTMENT', 'SALE', '1 Nguyen Hue', '30000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000001')`,
      [estateId, customerId],
    );
    return estateId;
  };

  it('discovers the module-owned migration exactly once', () => {
    const migrationNames = dataSource.migrations.map(
      (migration) => migration.constructor.name,
    );

    expect(
      migrationNames.filter((name) => name === MIGRATION_NAME),
    ).toHaveLength(1);
  });

  it('contracts fk_provider_id as NOT NULL on a fresh database', async () => {
    await expect(estateNullability('fk_provider_id')).resolves.toBe('NO');
  });

  it('keeps the legacy customer ownership column as provenance only', async () => {
    await expect(estateNullability('fk_customer_id')).resolves.toBe('NO');
  });

  it('rejects a new estate row without a provider owner', async () => {
    await dataSource.query(
      'TRUNCATE TABLE tbl_estate, tbl_provider_account, tbl_customer_account, tbl_role, tbl_ward, tbl_province CASCADE',
    );
    const customerId = await seedEstateOwner();

    await expect(insertEstateWithoutProvider(customerId)).rejects.toMatchObject(
      { code: '23502' },
    );
  });

  it('grandfathers an unresolved estate owner and contracts the column', async () => {
    await dataSource.query(
      'TRUNCATE TABLE tbl_estate, tbl_provider_account, tbl_customer_account, tbl_role, tbl_ward, tbl_province CASCADE',
    );
    await runContractDown();
    const customerId = await seedEstateOwner();
    await insertEstateWithoutProvider(customerId);
    await expect(estateNullability('fk_provider_id')).resolves.toBe('YES');

    await runContractUp();

    // The estate is bound to a grandfathered provider account of its owner.
    const boundRows: Array<{
      fk_provider_id: string;
      owner_customer_id: string;
    }> = await dataSource.query(
      `SELECT estate.fk_provider_id, provider.owner_customer_id
       FROM tbl_estate estate
       INNER JOIN tbl_provider_account provider ON provider.id = estate.fk_provider_id
       WHERE estate.id = '50000000-0000-4000-8000-000000000001'`,
    );
    expect(boundRows).toEqual([
      {
        fk_provider_id: expect.any(String) as string,
        owner_customer_id: customerId,
      },
    ]);
    await expect(estateNullability('fk_provider_id')).resolves.toBe('NO');
  });

  it('rolls back to nullable without deleting backfilled ownership data', async () => {
    const estateRows: Array<{ fk_provider_id: string }> =
      await dataSource.query(
        `SELECT fk_provider_id FROM tbl_estate WHERE id = '50000000-0000-4000-8000-000000000001'`,
      );
    expect(estateRows).toHaveLength(1);
    const boundProviderId = estateRows[0].fk_provider_id;

    await runContractDown();
    await expect(estateNullability('fk_provider_id')).resolves.toBe('YES');

    const preservedRows: CatalogRow[] = await dataSource.query(
      `SELECT fk_provider_id FROM tbl_estate WHERE id = '50000000-0000-4000-8000-000000000001'`,
    );
    expect(preservedRows).toEqual([{ fk_provider_id: boundProviderId }]);

    // Restore the contracted state for the rest of the suite.
    await runContractUp();
    await expect(estateNullability('fk_provider_id')).resolves.toBe('NO');
  });
});
