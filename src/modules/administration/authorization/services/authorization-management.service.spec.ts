import { AuthorizationPlatform } from '../enums/authorization-platform.enum';
import { AuthorizationManagementService } from './authorization-management.service';

describe('AuthorizationManagementService', () => {
  it('advertises all independent management platforms', () => {
    const service = new AuthorizationManagementService({} as never);
    expect(service.platforms().items.map((item) => item.platform)).toEqual([
      AuthorizationPlatform.MARKETPLACE,
      AuthorizationPlatform.PROVIDER,
      AuthorizationPlatform.ADMINISTRATION,
    ]);
  });

  it('rejects malformed role codes before opening a database transaction', async () => {
    const transaction = jest.fn();
    const service = new AuthorizationManagementService({
      transaction,
    } as never);

    await expect(
      service.createRole(
        AuthorizationPlatform.PROVIDER,
        { code: 'not-valid', name: 'Invalid role', permissionIds: [] },
        'admin-1',
        'request-1',
      ),
    ).rejects.toThrow();
    expect(transaction).not.toHaveBeenCalled();
  });

  it('returns a common paginated role summary without N+1 count queries', async () => {
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
          created_at: new Date('2026-01-01'),
          updated_at: new Date('2026-01-02'),
          permission_count: '2',
          assignment_count: '3',
        },
      ]);
    const service = new AuthorizationManagementService({ query } as never);

    await expect(
      service.listRoles(AuthorizationPlatform.PROVIDER, {
        page: 1,
        limit: 20,
        sort: 'name',
        order: 'asc',
      }),
    ).resolves.toMatchObject({
      items: [{ code: 'OWNER', permissionCount: 2, assignmentCount: 3 }],
      meta: { total: 1, page: 1, limit: 20 },
    });
    expect(query).toHaveBeenCalledTimes(2);
  });
});
