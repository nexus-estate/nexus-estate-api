import { AuthorizationPlatform } from '../enums/authorization-platform.enum';
import { AuthorizationManagementController } from './authorization-management.controller';

describe('AuthorizationManagementController', () => {
  it('delegates platform metadata to the management facade', () => {
    const platforms = jest.fn().mockReturnValue({ items: [] });
    const controller = new AuthorizationManagementController({
      platforms,
    } as never);

    expect(controller.platforms()).toEqual({ items: [] });
    expect(platforms).toHaveBeenCalledTimes(1);
  });

  it('delegates role creation with administrator identity and request id', async () => {
    const createRole = jest.fn().mockResolvedValue({ id: 'role-1' });
    const controller = new AuthorizationManagementController({
      createRole,
    } as never);
    const request = { requestId: 'request-1' };

    await expect(
      controller.createRole(
        AuthorizationPlatform.PROVIDER,
        { code: 'MANAGER', name: 'Manager', permissionIds: [] },
        { id: 'admin-1', email: 'admin@example.com', realm: 'administration' },
        request as never,
      ),
    ).resolves.toEqual({ id: 'role-1' });
    expect(createRole).toHaveBeenCalledWith(
      AuthorizationPlatform.PROVIDER,
      expect.objectContaining({ code: 'MANAGER' }),
      'admin-1',
      'request-1',
    );
  });
});
