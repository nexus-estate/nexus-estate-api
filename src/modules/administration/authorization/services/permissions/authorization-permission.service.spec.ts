import { AuthorizationPlatform } from '../../enums/authorization-platform.enum';
import { AuthorizationPermissionService } from './authorization-permission.service';

describe('AuthorizationPermissionService', () => {
  it('routes permission listing through its repository', async () => {
    const list = jest.fn().mockResolvedValue({ items: [], meta: { total: 0 } });
    const service = new AuthorizationPermissionService({ list } as never);
    const query = {
      page: 1,
      limit: 20,
      sort: 'category' as const,
      order: 'asc' as const,
      includeDeprecated: false,
    };

    await expect(
      service.list(AuthorizationPlatform.MARKETPLACE, query),
    ).resolves.toEqual({ items: [], meta: { total: 0 } });
    expect(list).toHaveBeenCalledWith(AuthorizationPlatform.MARKETPLACE, query);
  });

  it('routes permission role lookup through its repository', async () => {
    const roles = jest.fn().mockResolvedValue({ items: [] });
    const service = new AuthorizationPermissionService({ roles } as never);

    await expect(
      service.roles(AuthorizationPlatform.PROVIDER, 'permission-1'),
    ).resolves.toEqual({ items: [] });
    expect(roles).toHaveBeenCalledWith(
      AuthorizationPlatform.PROVIDER,
      'permission-1',
    );
  });
});
