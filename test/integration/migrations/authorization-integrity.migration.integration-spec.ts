import {
  PostgreSqlContainer,
  type StartedPostgreSqlContainer,
} from '@testcontainers/postgresql';
import { DataSource } from 'typeorm';
import type { PostgresConnectionOptions } from 'typeorm/driver/postgres/PostgresConnectionOptions';

import { BcryptService } from '../../../src/common/security/bcrypt.service';
import { typeOrmConfig } from '../../../src/database/type.config';
import { AddAuthorizationIntegrityAndInitializeSuperAdmin1789312966656 } from '../../../src/modules/administration/authorization/migrations/1789312966656-AddAuthorizationIntegrityAndInitializeSuperAdmin';
import { ADMINISTRATION_PERMISSION_REGISTRY } from '../../../src/modules/administration/authorization/permissions/administration-permission.registry';
import { MARKETPLACE_PERMISSION_REGISTRY } from '../../../src/modules/customer/authorization/permissions/marketplace-permission.registry';
import { PROVIDER_PERMISSION_REGISTRY } from '../../../src/modules/provider/authorization/permissions/provider-permission.registry';

jest.setTimeout(120_000);

const testAdminEmail = 'rc04-superadmin@nexus.test';
const testAdminPassword = 'RC04-Strong-Initial-Password!';

type ConstraintRow = { conname: string; definition: string };
type IndexRow = { indexname: string; indexdef: string };

describe('authorization integrity migration (PostgreSQL integration)', () => {
  let container: StartedPostgreSqlContainer;
  let dataSource: DataSource;

  beforeAll(async () => {
    process.env.INITIAL_ADMIN_EMAIL = testAdminEmail;
    process.env.INITIAL_ADMIN_PASSWORD = testAdminPassword;
    container = await new PostgreSqlContainer('postgres:18-alpine')
      .withDatabase('nexus_estate_authorization_integrity_test')
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
    delete process.env.INITIAL_ADMIN_EMAIL;
    delete process.env.INITIAL_ADMIN_PASSWORD;
    await dataSource?.destroy();
    await container?.stop();
  });

  it('persists the assigned-by FKs and bounded authorization constraints', async () => {
    const constraints = await dataSource.query<ConstraintRow[]>(`
      SELECT c.conname, pg_get_constraintdef(c.oid) AS definition
      FROM pg_constraint c
      INNER JOIN pg_class table_info ON table_info.oid = c.conrelid
      WHERE table_info.relname IN (
        'tbl_customer_role_assignment', 'tbl_provider_membership_role',
        'tbl_marketplace_role', 'tbl_provider_role', 'tbl_administration_role',
        'tbl_marketplace_permission', 'tbl_provider_permission',
        'tbl_administration_permission', 'tbl_provider_membership'
      )
    `);
    const definitions = new Map(
      constraints.map((constraint) => [
        constraint.conname,
        constraint.definition,
      ]),
    );

    expect(
      definitions.get('fk_customer_role_assignment_assigned_by'),
    ).toContain('tbl_administrator_account');
    expect(
      definitions.get('fk_customer_role_assignment_assigned_by'),
    ).toContain('ON DELETE SET NULL');
    expect(
      definitions.get('fk_provider_membership_role_assigned_by'),
    ).toContain('tbl_administrator_account');
    expect(
      definitions.get('fk_provider_membership_role_assigned_by'),
    ).toContain('ON DELETE SET NULL');
    expect(definitions.get('chk_marketplace_role_status')).toContain('ACTIVE');
    expect(definitions.get('chk_provider_role_version_positive')).toContain(
      '>= 1',
    );
    expect(
      definitions.get('chk_administration_permission_risk_level'),
    ).toContain('CRITICAL');
    expect(definitions.get('chk_provider_membership_status')).toContain(
      'REMOVED',
    );
  });

  it('keeps authorization column type, nullability, and defaults aligned', async () => {
    const columns = await dataSource.query<
      {
        table_name: string;
        column_name: string;
        data_type: string;
        is_nullable: string;
        column_default: string | null;
      }[]
    >(`
      SELECT table_name, column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name IN (
        'tbl_administration_role', 'tbl_provider_membership',
        'tbl_customer_role_assignment', 'tbl_provider_membership_role'
      )
        AND column_name IN (
          'status', 'version', 'assigned_by_admin_id'
        )
    `);
    const columnMap = new Map(
      columns.map((column) => [
        `${column.table_name}.${column.column_name}`,
        column,
      ]),
    );

    for (const key of [
      'tbl_administration_role.status',
      'tbl_provider_membership.status',
    ]) {
      expect(columnMap.get(key)).toMatchObject({
        data_type: 'character varying',
        is_nullable: 'NO',
      });
      expect(columnMap.get(key)?.column_default).toContain('ACTIVE');
    }
    expect(columnMap.get('tbl_administration_role.version')).toMatchObject({
      data_type: 'integer',
      is_nullable: 'NO',
    });
    expect(
      columnMap.get('tbl_administration_role.version')?.column_default,
    ).toContain('1');
    expect(
      columnMap.get('tbl_customer_role_assignment.assigned_by_admin_id'),
    ).toMatchObject({
      data_type: 'uuid',
      is_nullable: 'YES',
    });
    expect(
      columnMap.get('tbl_provider_membership_role.assigned_by_admin_id'),
    ).toMatchObject({
      data_type: 'uuid',
      is_nullable: 'YES',
    });
  });

  it('creates justified audit/context indexes and preserves registry parity', async () => {
    const indexes = await dataSource.query<IndexRow[]>(`
      SELECT indexname, indexdef
      FROM pg_indexes
      WHERE tablename IN ('tbl_authorization_audit_log', 'tbl_provider_membership')
    `);
    const indexDefinitions = new Map(
      indexes.map((index) => [index.indexname, index.indexdef]),
    );

    for (const indexName of [
      'idx_authorization_audit_platform_created_at',
      'idx_authorization_audit_actor_created_at',
      'idx_authorization_audit_action_created_at',
      'idx_authorization_audit_target_created_at',
      'idx_provider_membership_customer_provider_status',
    ]) {
      expect(indexDefinitions.has(indexName)).toBe(true);
    }

    const catalogue = await dataSource.query<{ code: string }[]>(`
      SELECT code FROM tbl_administration_permission
      WHERE deleted_at IS NULL ORDER BY code
    `);
    const providerCatalogue = await dataSource.query<{ code: string }[]>(`
      SELECT code FROM tbl_provider_permission
      WHERE deleted_at IS NULL ORDER BY code
    `);
    const marketplaceCatalogue = await dataSource.query<{ code: string }[]>(`
      SELECT code FROM tbl_marketplace_permission
      WHERE deleted_at IS NULL ORDER BY code
    `);

    expect(catalogue.map((row) => row.code).sort()).toEqual(
      ADMINISTRATION_PERMISSION_REGISTRY.map(
        (permission) => permission.code,
      ).sort(),
    );
    expect(providerCatalogue.map((row) => row.code).sort()).toEqual(
      PROVIDER_PERMISSION_REGISTRY.map((permission) => permission.code).sort(),
    );
    expect(marketplaceCatalogue.map((row) => row.code).sort()).toEqual(
      MARKETPLACE_PERMISSION_REGISTRY.map(
        (permission) => permission.code,
      ).sort(),
    );
  });

  it('provisions an active hashed Super Admin and is idempotent', async () => {
    const accountRows = await dataSource.query<
      {
        id: string;
        password: string;
        is_active: boolean;
        deleted_at: Date | null;
      }[]
    >(
      `SELECT id, password, is_active, deleted_at
       FROM tbl_administrator_account WHERE email = $1`,
      [testAdminEmail],
    );
    expect(accountRows).toHaveLength(1);
    expect(accountRows[0].is_active).toBe(true);
    expect(accountRows[0].deleted_at).toBeNull();
    await expect(
      new BcryptService().compare(testAdminPassword, accountRows[0].password),
    ).resolves.toBe(true);

    const runner = dataSource.createQueryRunner();
    await runner.connect();
    try {
      await new AddAuthorizationIntegrityAndInitializeSuperAdmin1789312966656().up(
        runner,
      );
    } finally {
      await runner.release();
    }

    const counts = await dataSource.query<
      { account_count: string; assignment_count: string }[]
    >(
      `SELECT
         (SELECT COUNT(*) FROM tbl_administrator_account WHERE email = $1) AS account_count,
         (SELECT COUNT(*)
            FROM tbl_administrator_role_assignment assignment
            INNER JOIN tbl_administrator_account account
              ON account.id = assignment.administrator_id
            INNER JOIN tbl_administration_role role ON role.id = assignment.role_id
           WHERE account.email = $1 AND role.code = 'SUPER_ADMIN') AS assignment_count`,
      [testAdminEmail],
    );
    expect(counts[0]).toEqual({ account_count: '1', assignment_count: '1' });
  });
});
