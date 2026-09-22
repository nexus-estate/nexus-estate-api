import { BackfillProviderSupplyReadPermissions1790063077456 } from './1790063077456-BackfillProviderSupplyReadPermissions';

describe('BackfillProviderSupplyReadPermissions', () => {
  it('backfills only read permissions for currently valid provider readers', async () => {
    const query = jest.fn().mockResolvedValue(undefined);

    await new BackfillProviderSupplyReadPermissions1790063077456().up({
      query,
    } as never);

    const sql = query.mock.calls.map(([value]) => String(value)).join('\n');
    expect(sql).toContain("membership.status = 'ACTIVE'");
    expect(sql).toContain("provider.status = 'ACTIVE'");
    expect(sql).toContain("provider.verification_status = 'VERIFIED'");
    expect(sql).toContain("'property:read', 'listing:read'");
    expect(sql).toContain('NOT EXISTS');
    expect(sql).not.toContain("'property:update'");
    expect(sql).not.toContain("role.code = 'AGENT'");
  });

  it('rolls back only mappings recorded by this migration', async () => {
    const query = jest.fn().mockResolvedValue(undefined);

    await new BackfillProviderSupplyReadPermissions1790063077456().down({
      query,
    } as never);

    const sql = query.mock.calls.map(([value]) => String(value)).join('\n');
    expect(sql).toContain('tbl_provider_supply_read_permission_backfill');
    expect(sql).toContain('DROP TABLE IF EXISTS');
  });
});
