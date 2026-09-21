import {
  PostgreSqlContainer,
  type StartedPostgreSqlContainer,
} from '@testcontainers/postgresql';
import { DataSource } from 'typeorm';
import type { PostgresConnectionOptions } from 'typeorm/driver/postgres/PostgresConnectionOptions';

import { typeOrmConfig } from '../../../src/database/type.config';
import { ContractEstateProviderOwnership1789999894372 } from '../../../src/modules/estate/property/migrations/1789999894372-ContractEstateProviderOwnership';

jest.setTimeout(120_000);

type CatalogRow = Record<string, string | null>;

const MIGRATION_NAME = 'ContractEstateProviderOwnership1789999894372';

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
      await new ContractEstateProviderOwnership1789999894372().up(queryRunner);
    } finally {
      await queryRunner.release();
    }
  };

  const runContractDown = async (): Promise<void> => {
    const queryRunner = dataSource.createQueryRunner();
    await queryRunner.connect();
    try {
      await new ContractEstateProviderOwnership1789999894372().down(
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

  /** Empties estate/provider state and relaxes the NOT NULL contract. */
  const resetToPreContractState = async (): Promise<void> => {
    await dataSource.query(
      `TRUNCATE TABLE tbl_estate, tbl_provider_membership,
        tbl_provider_membership_role, tbl_provider_account,
        tbl_customer_account, tbl_role, tbl_ward, tbl_province CASCADE`,
    );
    await runContractDown();
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

  /** Inserts a legacy provider account with explicit lifecycle states. */
  const seedProviderAccount = async (
    customerId: string,
    status = 'ACTIVE',
  ): Promise<string> => {
    const rows: { id: string }[] = await dataSource.query(
      `INSERT INTO tbl_provider_account
         (owner_customer_id, type, display_name, status, verification_status)
       VALUES ($1, 'INDIVIDUAL', 'Legacy Provider', $2, 'VERIFIED')
       RETURNING id`,
      [customerId, status],
    );
    return rows[0].id;
  };

  /** Inserts a membership row with explicit lifecycle states. */
  const seedMembership = async (
    providerId: string,
    customerId: string,
    status: 'ACTIVE' | 'SUSPENDED' | 'REMOVED',
    softDeleted = false,
  ): Promise<void> => {
    await dataSource.query(
      `INSERT INTO tbl_provider_membership (provider_id, customer_id, status, deleted_at)
       VALUES ($1, $2, $3, $4)`,
      [
        providerId,
        customerId,
        status,
        softDeleted ? new Date().toISOString() : null,
      ],
    );
  };

  const estateRows = async (): Promise<
    Array<{ id: string; fk_provider_id: string | null }>
  > =>
    dataSource.query(
      `SELECT id::text, fk_provider_id FROM tbl_estate ORDER BY id`,
    );

  /** Seeds the OWNER provider role (idempotent) and returns its id. */
  const seedProviderOwnerRole = async (): Promise<string> => {
    const rows: { id: string }[] = await dataSource.query(
      `INSERT INTO tbl_provider_role (code, name, is_system)
       VALUES ('OWNER', 'Owner', true)
       ON CONFLICT (code) DO NOTHING
       RETURNING id`,
    );
    if (rows[0]?.id) {
      return rows[0].id;
    }
    const existing: { id: string }[] = await dataSource.query(
      `SELECT id FROM tbl_provider_role WHERE code = 'OWNER'`,
    );
    return existing[0].id;
  };

  /** Inserts a membership-role assignment row. */
  const seedMembershipRole = async (
    membershipId: string,
    roleId: string,
  ): Promise<void> => {
    await dataSource.query(
      `INSERT INTO tbl_provider_membership_role (membership_id, role_id)
       VALUES ($1, $2)
       ON CONFLICT (membership_id, role_id) DO NOTHING`,
      [membershipId, roleId],
    );
  };

  /** Returns the membership row for one provider/customer pair. */
  const getMembership = async (
    providerId: string,
    customerId: string,
  ): Promise<
    | {
        id: string;
        status: string;
        deleted_at: string | null;
      }
    | undefined
  > => {
    const rows: Array<{
      id: string;
      status: string;
      deleted_at: string | null;
    }> = await dataSource.query(
      `SELECT id::text, status, deleted_at FROM tbl_provider_membership
       WHERE provider_id = $1 AND customer_id = $2`,
      [providerId, customerId],
    );
    return rows[0];
  };

  /** Returns the role codes assigned to one membership. */
  const getMembershipRoleCodes = async (
    membershipId: string,
  ): Promise<string[]> => {
    const rows: Array<{ code: string }> = await dataSource.query(
      `SELECT role.code FROM tbl_provider_membership_role assignment
       INNER JOIN tbl_provider_role role ON role.id = assignment.role_id
       WHERE assignment.membership_id = $1
       ORDER BY role.code`,
      [membershipId],
    );
    return rows.map((row) => row.code);
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

  it('backfills soft-deleted estates and contracts every row before NOT NULL', async () => {
    await resetToPreContractState();
    const customerId = await seedEstateOwner();
    const estateId = await insertEstateWithoutProvider(customerId);
    await dataSource.query(
      `UPDATE tbl_estate SET deleted_at = now() WHERE id = $1`,
      [estateId],
    );

    await runContractUp();

    // Even the soft-deleted estate row must carry canonical ownership.
    const rows = await estateRows();
    expect(rows).toHaveLength(1);
    expect(rows[0].fk_provider_id).not.toBeNull();
    await expect(estateNullability('fk_provider_id')).resolves.toBe('NO');
  });

  it('fails explicitly when an estate cannot resolve a provider', async () => {
    await resetToPreContractState();
    const customerId = await seedEstateOwner();
    await insertEstateWithoutProvider(customerId);
    const providerId = await seedProviderAccount(customerId);
    // Sever the resolution path: the only candidate provider is deleted, so
    // neither grandfathering nor the backfill can bind the estate.
    await dataSource.query(
      `UPDATE tbl_provider_account SET deleted_at = now() WHERE id = $1`,
      [providerId],
    );

    await expect(runContractUp()).rejects.toThrow(
      /estate\(s\) have no resolvable provider/i,
    );
    // The contract phase must not have happened.
    await expect(estateNullability('fk_provider_id')).resolves.toBe('YES');
  });

  it.each(['SUSPENDED', 'REMOVED'] as const)(
    'preserves a %s membership instead of reactivating it',
    async (membershipStatus) => {
      await resetToPreContractState();
      const customerId = await seedEstateOwner();
      await insertEstateWithoutProvider(customerId);
      const providerId = await seedProviderAccount(customerId);
      await seedMembership(providerId, customerId, membershipStatus);

      await runContractUp();

      const memberships: Array<{
        status: string;
        deleted_at: string | null;
      }> = await dataSource.query(
        `SELECT status, deleted_at FROM tbl_provider_membership
         WHERE provider_id = $1 AND customer_id = $2`,
        [providerId, customerId],
      );
      expect(memberships).toHaveLength(1);
      expect(memberships[0].status).toBe(membershipStatus);
      expect(memberships[0].deleted_at).toBeNull();
    },
  );

  it('preserves soft-deleted memberships instead of restoring them', async () => {
    await resetToPreContractState();
    const customerId = await seedEstateOwner();
    await insertEstateWithoutProvider(customerId);
    const providerId = await seedProviderAccount(customerId);
    await seedMembership(providerId, customerId, 'ACTIVE', true);

    await runContractUp();

    const memberships: Array<{ status: string; deleted_at: string | null }> =
      await dataSource.query(
        `SELECT status, deleted_at FROM tbl_provider_membership
         WHERE provider_id = $1 AND customer_id = $2`,
        [providerId, customerId],
      );
    expect(memberships).toHaveLength(1);
    expect(memberships[0].status).toBe('ACTIVE');
    expect(memberships[0].deleted_at).not.toBeNull();
  });

  it('preserves suspended provider accounts instead of unsuspending them', async () => {
    await resetToPreContractState();
    const customerId = await seedEstateOwner();
    await insertEstateWithoutProvider(customerId);
    const providerId = await seedProviderAccount(customerId, 'SUSPENDED');

    await runContractUp();

    const providers: Array<{ status: string; verification_status: string }> =
      await dataSource.query(
        `SELECT status, verification_status FROM tbl_provider_account WHERE id = $1`,
        [providerId],
      );
    expect(providers).toHaveLength(1);
    expect(providers[0].status).toBe('SUSPENDED');
    expect(providers[0].verification_status).toBe('VERIFIED');

    // The estate is still bound to the provider — runtime denies access.
    const rows = await estateRows();
    expect(rows[0].fk_provider_id).toBe(providerId);
  });

  it('inserts only missing memberships and keeps active ones untouched', async () => {
    await resetToPreContractState();
    const customerId = await seedEstateOwner();
    await insertEstateWithoutProvider(customerId);
    const providerId = await seedProviderAccount(customerId);
    await seedMembership(providerId, customerId, 'ACTIVE');
    const before: Array<{ joined_at: string }> = await dataSource.query(
      `SELECT joined_at FROM tbl_provider_membership
       WHERE provider_id = $1 AND customer_id = $2`,
      [providerId, customerId],
    );

    await runContractUp();

    const memberships: Array<{ joined_at: string }> = await dataSource.query(
      `SELECT joined_at FROM tbl_provider_membership
       WHERE provider_id = $1 AND customer_id = $2`,
      [providerId, customerId],
    );
    expect(memberships).toHaveLength(1);
    expect(memberships[0].joined_at).toEqual(before[0].joined_at);
  });

  it('does not restore OWNER to an existing membership when ownership was transferred', async () => {
    await resetToPreContractState();
    const customerId = await seedEstateOwner();
    await insertEstateWithoutProvider(customerId);
    const providerId = await seedProviderAccount(customerId);
    const ownerRoleId = await seedProviderOwnerRole();

    // Another customer holds the active membership WITH the OWNER role, while
    // the legacy owner_customer_id keeps an active membership WITHOUT it —
    // authorization was already transferred and must not silently revert.
    const transferredCustomerId = '20000000-0000-4000-8000-000000000002';
    await dataSource.query(
      `INSERT INTO tbl_customer_account (id, email, password, role_id)
       VALUES ($1, 'transferred-owner@nexus.test', 'hash', '10000000-0000-4000-8000-000000000001')`,
      [transferredCustomerId],
    );
    await seedMembership(providerId, customerId, 'ACTIVE');
    await seedMembership(providerId, transferredCustomerId, 'ACTIVE');
    const legacyOwnerMembership = await getMembership(providerId, customerId);
    const transferredMembership = await getMembership(
      providerId,
      transferredCustomerId,
    );
    expect(legacyOwnerMembership).toBeDefined();
    expect(transferredMembership).toBeDefined();
    await seedMembershipRole(transferredMembership!.id, ownerRoleId);

    await runContractUp();

    const estateAfter = await estateRows();
    expect(estateAfter[0].fk_provider_id).toBe(providerId);

    const legacyRoles = await getMembershipRoleCodes(legacyOwnerMembership!.id);
    expect(legacyRoles).not.toContain('OWNER');

    const transferredRoles = await getMembershipRoleCodes(
      transferredMembership!.id,
    );
    expect(transferredRoles).toEqual(['OWNER']);

    // Both memberships keep their original lifecycle state.
    expect((await getMembership(providerId, customerId))!.status).toBe(
      'ACTIVE',
    );
    expect(
      (await getMembership(providerId, transferredCustomerId))!.status,
    ).toBe('ACTIVE');
  });

  it('creates the missing owner membership with the OWNER role', async () => {
    await resetToPreContractState();
    const customerId = await seedEstateOwner();
    await insertEstateWithoutProvider(customerId);
    const providerId = await seedProviderAccount(customerId);
    await seedProviderOwnerRole();
    expect(await getMembership(providerId, customerId)).toBeUndefined();

    await runContractUp();

    const created = await getMembership(providerId, customerId);
    expect(created).toBeDefined();
    expect(created!.status).toBe('ACTIVE');
    expect(created!.deleted_at).toBeNull();
    expect(await getMembershipRoleCodes(created!.id)).toEqual(['OWNER']);

    // Estate is bound to the same provider the new membership belongs to.
    const rows = await estateRows();
    expect(rows[0].fk_provider_id).toBe(providerId);
  });

  it('is safe to rerun after a completed contract', async () => {
    await resetToPreContractState();
    const customerId = await seedEstateOwner();
    await insertEstateWithoutProvider(customerId);

    await runContractUp();
    const afterFirstRun = await estateRows();

    await expect(runContractUp()).resolves.toBeUndefined();
    expect(await estateRows()).toEqual(afterFirstRun);
    await expect(estateNullability('fk_provider_id')).resolves.toBe('NO');
  });
});
