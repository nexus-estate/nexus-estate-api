import { AuthorizationEffectiveService } from './authorization-effective.service';

describe('AuthorizationEffectiveService', () => {
  it('returns current active administrator roles, permissions, and version', async () => {
    const query = jest
      .fn()
      .mockResolvedValueOnce([{ is_active: true }])
      .mockResolvedValueOnce([
        { id: 'role-1', code: 'SUPER_ADMIN', name: 'Super administrator' },
      ])
      .mockResolvedValueOnce([
        {
          id: 'permission-1',
          code: 'authorization:role:read',
          name: 'Read roles',
          category: 'Authorization',
        },
      ])
      .mockResolvedValueOnce([{ version: 'v1' }]);
    const service = new AuthorizationEffectiveService({ query } as never);

    await expect(service.effective('admin-1')).resolves.toMatchObject({
      platform: 'ADMINISTRATION',
      isActive: true,
      roles: [{ code: 'SUPER_ADMIN' }],
      permissions: [{ code: 'authorization:role:read' }],
      authorizationVersion: 'v1',
    });
  });

  it('hides effective grants when the administrator is inactive', async () => {
    const query = jest
      .fn()
      .mockResolvedValueOnce([{ is_active: false }])
      .mockResolvedValueOnce([
        { id: 'role-1', code: 'SUPER_ADMIN', name: 'Super administrator' },
      ])
      .mockResolvedValueOnce([
        {
          id: 'permission-1',
          code: 'authorization:role:read',
          name: 'Read roles',
          category: 'Authorization',
        },
      ])
      .mockResolvedValueOnce([{ version: 'v2' }]);
    const service = new AuthorizationEffectiveService({ query } as never);

    await expect(service.effective('admin-1')).resolves.toMatchObject({
      isActive: false,
      roles: [],
      permissions: [],
    });
  });
});
