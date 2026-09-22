import { BackfillRolelessProviderSupplyReaders1790065589751 } from './1790065589751-BackfillRolelessProviderSupplyReaders';

describe('BackfillRolelessProviderSupplyReaders', () => {
  it('creates explicit read-only MEMBER access for valid roleless memberships', async () => {
    const query = jest.fn().mockImplementation((sql: string) => {
      if (sql.includes('SELECT id::text AS id')) return [];
      if (sql.includes('RETURNING id::text AS id')) {
        return [{ id: 'member-role-id' }];
      }
      return [];
    });

    await new BackfillRolelessProviderSupplyReaders1790065589751().up({
      query,
    } as never);

    const sql = query.mock.calls.map(([value]) => String(value)).join('\n');
    expect(sql).toContain("WHERE code = 'MEMBER'");
    expect(sql).toContain('WHERE role.id = $1');
    expect(sql).toContain("membership.status = 'ACTIVE'");
    expect(sql).toContain("provider.verification_status = 'VERIFIED'");
    expect(sql).toContain("'property:read', 'listing:read'");
    expect(sql).toContain('tbl_provider_supply_member_assignment_backfill');
    expect(sql).not.toContain("'property:create'");
    expect(sql).not.toContain("'listing:publish'");
    expect(sql).not.toContain("role.code = 'AGENT'");
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
      new BackfillRolelessProviderSupplyReaders1790065589751().up({
        query,
      } as never),
    ).rejects.toThrow(/not owned by this migration/);
  });

  it('rolls back only migration-owned rows and preserves runtime usage', async () => {
    const query = jest.fn().mockResolvedValue(undefined);

    await new BackfillRolelessProviderSupplyReaders1790065589751().down({
      query,
    } as never);

    const sql = query.mock.calls.map(([value]) => String(value)).join('\n');
    expect(sql).toContain('tbl_provider_supply_member_assignment_backfill');
    expect(sql).toContain('tbl_provider_supply_member_permission_backfill');
    expect(sql).toContain('tbl_provider_supply_member_role_backfill');
    expect(sql).toContain('DROP TABLE IF EXISTS');
    expect(sql).toContain('NOT EXISTS');
  });
});
