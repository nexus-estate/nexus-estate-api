import { AddProviderSupplyPermissions1790058166348 } from './1790058166348-AddProviderSupplyPermissions';

describe('AddProviderSupplyPermissions', () => {
  const createSuccessfulUpQuery = () =>
    jest.fn().mockImplementation((sql: string) => {
      if (sql.includes('SELECT id::text AS id')) return [];
      if (sql.includes('RETURNING id::text AS id')) {
        return [{ id: 'member-role-id' }];
      }
      return [];
    });

  const createSuccessfulDownQuery = () =>
    jest.fn().mockImplementation((sql: string) => {
      if (sql.includes('role_backfill_exists')) {
        return [
          {
            role_backfill_exists: true,
            permission_backfill_exists: true,
            assignment_backfill_exists: true,
          },
        ];
      }
      if (sql.includes('SELECT role.id::text AS role_id')) {
        return [{ role_id: 'member-role-id' }];
      }
      return [];
    });

  it('inserts the eight code-owned capabilities and idempotent OWNER mappings', async () => {
    const query = createSuccessfulUpQuery();

    await new AddProviderSupplyPermissions1790058166348().up({
      query,
    } as never);

    const sql = query.mock.calls.map(([value]) => String(value)).join('\n');
    for (const code of [
      'property:read',
      'property:create',
      'property:update',
      'property:archive',
      'listing:read',
      'listing:create',
      'listing:publish',
      'listing:archive',
    ]) {
      expect(sql).toContain(`'${code}'`);
    }
    expect(sql).toContain('risk_level');
    expect(sql).toContain('is_assignable');
    expect(sql).toContain('ON CONFLICT (code) DO UPDATE');
    expect(sql).toContain('ON CONFLICT (role_id, permission_id) DO NOTHING');
    expect(sql).not.toContain('platform');
  });

  it('backfills only read permissions for currently valid provider readers with roles', async () => {
    const query = createSuccessfulUpQuery();

    await new AddProviderSupplyPermissions1790058166348().up({
      query,
    } as never);

    const sql = query.mock.calls.map(([value]) => String(value)).join('\n');
    expect(sql).toContain('tbl_provider_supply_read_permission_backfill');
    expect(sql).toContain("membership.status = 'ACTIVE'");
    expect(sql).toContain("provider.status = 'ACTIVE'");
    expect(sql).toContain("provider.verification_status = 'VERIFIED'");
    expect(sql).toContain("'property:read', 'listing:read'");
    expect(sql).toContain('NOT EXISTS');
    expect(sql).not.toContain("role.code = 'AGENT'");
  });

  it('creates explicit read-only MEMBER access for valid roleless memberships', async () => {
    const query = createSuccessfulUpQuery();

    await new AddProviderSupplyPermissions1790058166348().up({
      query,
    } as never);

    const sql = query.mock.calls.map(([value]) => String(value)).join('\n');
    expect(sql).toContain("WHERE code = 'MEMBER'");
    expect(sql).toContain('WHERE role.id = $1');
    expect(sql).toContain('tbl_provider_supply_member_assignment_backfill');
    expect(sql).toContain('tbl_provider_supply_member_permission_backfill');
    expect(sql).not.toContain('UPDATE tbl_provider_role');
  });

  it('rejects a pre-existing MEMBER role that is not migration-owned', async () => {
    const query = jest.fn().mockImplementation((sql: string) => {
      if (sql.includes('SELECT id::text AS id')) {
        return [{ id: 'existing-member-role-id' }];
      }
      if (sql.includes('to_regclass')) return [{ exists: false }];
      return [];
    });

    await expect(
      new AddProviderSupplyPermissions1790058166348().up({
        query,
      } as never),
    ).rejects.toThrow(/not owned by this migration/);
  });

  it('rolls back MEMBER, read backfills, and permission catalogue in reverse dependency order', async () => {
    const query = createSuccessfulDownQuery();

    await new AddProviderSupplyPermissions1790058166348().down({
      query,
    } as never);

    const sql = query.mock.calls.map(([value]) => String(value)).join('\n');

    expect(sql).toContain('tbl_provider_supply_member_assignment_backfill');
    expect(sql).toContain('tbl_provider_supply_member_permission_backfill');
    expect(sql).toContain('tbl_provider_supply_member_role_backfill');
    expect(sql).toContain('tbl_provider_supply_read_permission_backfill');
    expect(sql).toContain("role.code = 'OWNER'");
    expect(sql).toContain('NOT EXISTS');

    const memberRollbackIndex = sql.indexOf(
      'DELETE FROM tbl_provider_membership_role assignment',
    );
    const readRollbackIndex = sql.indexOf(
      'USING tbl_provider_supply_read_permission_backfill backfill',
    );
    const ownerRollbackIndex = sql.indexOf("role.code = 'OWNER'");

    expect(memberRollbackIndex).toBeGreaterThanOrEqual(0);
    expect(readRollbackIndex).toBeGreaterThan(memberRollbackIndex);
    expect(ownerRollbackIndex).toBeGreaterThan(readRollbackIndex);
  });
});
