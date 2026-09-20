import { AuthorizationPlatform } from '../../enums/authorization-platform.enum';
import { AuthorizationRoleRepository } from './authorization-role.repository';

describe('AuthorizationRoleRepository', () => {
  it('maps paginated role rows and preserves usage counts', async () => {
    const query = jest
      .fn()
      .mockResolvedValueOnce([{ total: '1' }])
      .mockResolvedValueOnce([
        {
          id: 'role-1',
          code: 'OWNER',
          name: 'Owner',
          description: null,
          is_system: true,
          status: 'ACTIVE',
          version: 1,
          permission_count: '2',
          assignment_count: '3',
          created_at: new Date('2026-01-01'),
          updated_at: new Date('2026-01-02'),
        },
      ]);
    const repository = new AuthorizationRoleRepository({ query } as never);

    await expect(
      repository.list(AuthorizationPlatform.PROVIDER, {
        page: 1,
        limit: 20,
        sort: 'name',
        order: 'asc',
      }),
    ).resolves.toMatchObject({
      items: [
        {
          code: 'OWNER',
          permissionCount: 2,
          assignmentCount: 3,
          allowedActions: { delete: false, updateStatus: false },
        },
      ],
      meta: { total: 1, page: 1, limit: 20 },
    });
    expect(query).toHaveBeenCalledTimes(2);
  });

  it('loads a role and its permissions through one canonical detail query', async () => {
    const query = jest
      .fn()
      .mockResolvedValueOnce([
        {
          id: 'role-1',
          code: 'REVIEWER',
          name: 'Reviewer',
          description: null,
          is_system: false,
          status: 'ACTIVE',
          version: 2,
          permission_count: '1',
          assignment_count: '0',
          created_at: new Date('2026-01-01'),
          updated_at: new Date('2026-01-02'),
        },
      ])
      .mockResolvedValueOnce([
        {
          id: 'permission-1',
          code: 'listing:read',
          name: 'Read listings',
          description: null,
          category: 'listing',
          resource: 'listing',
          action: 'read',
          risk_level: 'LOW',
          is_assignable: true,
          deprecated_at: null,
          created_at: new Date('2026-01-01'),
          updated_at: new Date('2026-01-02'),
        },
      ]);
    const repository = new AuthorizationRoleRepository({ query } as never);

    await expect(
      repository.findById(AuthorizationPlatform.MARKETPLACE, 'role-1'),
    ).resolves.toMatchObject({
      id: 'role-1',
      permissions: [{ code: 'listing:read', riskLevel: 'LOW' }],
    });
  });
});
