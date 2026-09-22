import { AddProviderSupplyPermissions1790058166348 } from './1790058166348-AddProviderSupplyPermissions';

describe('AddProviderSupplyPermissions', () => {
  it('inserts the eight code-owned capabilities and idempotent OWNER mappings', async () => {
    const query = jest.fn().mockResolvedValue(undefined);

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

  it('keeps rollback scoped to the new permission codes and safe mappings', async () => {
    const query = jest.fn().mockResolvedValue(undefined);

    await new AddProviderSupplyPermissions1790058166348().down({
      query,
    } as never);

    const sql = query.mock.calls.map(([value]) => String(value)).join('\n');
    expect(sql).toContain("role.code = 'OWNER'");
    expect(sql).toContain('NOT EXISTS');
    expect(sql).not.toContain('DROP TABLE');
  });
});
