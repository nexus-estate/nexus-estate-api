import {
  PostgreSqlContainer,
  type StartedPostgreSqlContainer,
} from '@testcontainers/postgresql';
import { DataSource } from 'typeorm';
import type { PostgresConnectionOptions } from 'typeorm/driver/postgres/PostgresConnectionOptions';

import { typeOrmConfig } from '../../../src/database/type.config';
import { PERMISSIONS } from '../../../src/utils/constants/permission.constant';
import { ROLES } from '../../../src/utils/constants/role.constant';

jest.setTimeout(120_000);

type RolePermissionRow = {
  role_name: string;
  permission_name: string;
};

describe('RBAC base roles and permissions migration (PostgreSQL integration)', () => {
  let container: StartedPostgreSqlContainer;
  let dataSource: DataSource;

  beforeAll(async () => {
    container = await new PostgreSqlContainer('postgres:18-alpine')
      .withDatabase('nexus_estate_rbac_migration_test')
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

  it('creates exactly the three persisted base roles', async () => {
    const rows: Array<{ name: string }> = await dataSource.query(
      'SELECT name FROM tbl_role ORDER BY name',
    );

    expect(rows.map(({ name }) => name)).toEqual(
      [ROLES.ADMINISTRATOR, ROLES.BUYER, ROLES.SELLER].sort(),
    );
    expect(rows.some(({ name }) => name === 'anonymous')).toBe(false);
  });

  it('assigns buyer and seller permissions without leaking administrator access', async () => {
    const rows: RolePermissionRow[] = await dataSource.query(`
      SELECT role.name AS role_name, permission.name AS permission_name
      FROM tbl_role_permissions AS role_permission
      INNER JOIN tbl_role AS role ON role.id = role_permission.role_id
      INNER JOIN tbl_permission AS permission
        ON permission.id = role_permission.permission_id
      WHERE role.name IN ('${ROLES.BUYER}', '${ROLES.SELLER}', '${ROLES.ADMINISTRATOR}')
    `);
    const permissionsByRole = new Map<string, Set<string>>();
    for (const row of rows) {
      const permissions = permissionsByRole.get(row.role_name) ?? new Set();
      permissions.add(row.permission_name);
      permissionsByRole.set(row.role_name, permissions);
    }

    expect(permissionsByRole.get(ROLES.BUYER)).toEqual(expect.any(Set));
    expect(
      permissionsByRole
        .get(ROLES.BUYER)
        ?.has(PERMISSIONS.SELLER_ACCOUNT_REGISTER),
    ).toBe(true);
    expect(
      permissionsByRole.get(ROLES.BUYER)?.has(PERMISSIONS.SELLER_ACCOUNT_READ),
    ).toBe(true);
    expect(
      permissionsByRole.get(ROLES.SELLER)?.has(PERMISSIONS.ESTATE_CREATE),
    ).toBe(true);
    expect(
      permissionsByRole
        .get(ROLES.SELLER)
        ?.has(PERMISSIONS.SELLER_ACCOUNT_APPROVE),
    ).toBe(false);
    expect(
      permissionsByRole.get(ROLES.BUYER)?.has(PERMISSIONS.ADMIN_PORTAL_ACCESS),
    ).toBe(false);
    expect(
      permissionsByRole
        .get(ROLES.ADMINISTRATOR)
        ?.has(PERMISSIONS.ADMIN_PORTAL_ACCESS),
    ).toBe(true);
    expect(
      permissionsByRole.get(ROLES.ADMINISTRATOR)?.has(PERMISSIONS.METRICS_READ),
    ).toBe(true);
  });
});
