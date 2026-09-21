import { AuthorizationPlatform } from '../../enums/authorization-platform.enum';
import { AuthorizationRoleService } from './authorization-role.service';
import { createAuthorizationContext } from '../../context/authorization-context';

describe('AuthorizationRoleService', () => {
  const providerContext = createAuthorizationContext(
    AuthorizationPlatform.PROVIDER,
  );
  const administrationContext = createAuthorizationContext(
    AuthorizationPlatform.ADMINISTRATION,
  );
  it('lists roles through the role repository with the platform context', async () => {
    const list = jest.fn().mockResolvedValue({ items: [], meta: { total: 0 } });
    const service = new AuthorizationRoleService({ list } as never);
    const query = {
      page: 1,
      limit: 20,
      sort: 'name' as const,
      order: 'asc' as const,
    };

    await expect(service.list(providerContext, query)).resolves.toEqual({
      items: [],
      meta: { total: 0 },
    });
    expect(list).toHaveBeenCalledWith(providerContext, query);
  });

  it('loads one role through the role repository', async () => {
    const detail = { id: 'role-1', code: 'OWNER' };
    const findById = jest.fn().mockResolvedValue(detail);
    const service = new AuthorizationRoleService({ findById } as never);

    await expect(service.get(administrationContext, 'role-1')).resolves.toEqual(
      detail,
    );
    expect(findById).toHaveBeenCalledWith(administrationContext, 'role-1');
  });
});
