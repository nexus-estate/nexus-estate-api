import { BackfillAdministratorRoleAssignments1789400000001 } from './1789400000001-BackfillAdministratorRoleAssignments';

describe('BackfillAdministratorRoleAssignments', () => {
  it('uses an idempotent scoped SUPER_ADMIN backfill', async () => {
    const query = jest.fn().mockResolvedValue(undefined);
    await new BackfillAdministratorRoleAssignments1789400000001().up({
      query,
    } as never);
    const calls = query.mock.calls as unknown as Array<[string]>;
    const sql = calls[0][0];
    expect(sql).toContain('SUPER_ADMIN');
    expect(sql).toContain('ON CONFLICT (administrator_id, role_id) DO NOTHING');
    expect(sql).toContain('NOT EXISTS');
  });

  it('removes only SUPER_ADMIN assignments on down', async () => {
    const query = jest.fn().mockResolvedValue(undefined);
    await new BackfillAdministratorRoleAssignments1789400000001().down({
      query,
    } as never);
    const calls = query.mock.calls as unknown as Array<[string]>;
    expect(calls[0][0]).toContain("role.code = 'SUPER_ADMIN'");
  });
});
