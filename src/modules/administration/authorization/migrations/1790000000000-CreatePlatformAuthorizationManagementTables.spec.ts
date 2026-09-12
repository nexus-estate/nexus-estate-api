import { CreatePlatformAuthorizationManagementTables1790000000000 } from './1790000000000-CreatePlatformAuthorizationManagementTables';

describe('CreatePlatformAuthorizationManagementTables', () => {
  it('expands all platform tables and includes owner backfill without destructive drops', async () => {
    const query = jest.fn().mockResolvedValue(undefined);
    await new CreatePlatformAuthorizationManagementTables1790000000000().up({
      query,
    } as never);
    const sql = query.mock.calls.map(([value]) => String(value)).join('\n');

    for (const table of [
      'tbl_marketplace_role',
      'tbl_marketplace_permission',
      'tbl_customer_role_assignment',
      'tbl_provider_membership',
      'tbl_provider_role',
      'tbl_provider_permission',
      'tbl_provider_membership_role',
      'tbl_authorization_audit_log',
    ]) {
      expect(sql).toContain(table);
    }
    expect(sql).toContain("VALUES ('OWNER'");
    expect(sql).toContain('ON CONFLICT (provider_id, customer_id) DO NOTHING');
    expect(sql).not.toMatch(/DROP TABLE/i);
  });

  it('provides an explicit rollback for the expand migration', async () => {
    const query = jest.fn().mockResolvedValue(undefined);
    await new CreatePlatformAuthorizationManagementTables1790000000000().down({
      query,
    } as never);
    expect(
      query.mock.calls.map(([value]) => String(value)).join('\n'),
    ).toContain('DROP TABLE IF EXISTS');
  });
});
