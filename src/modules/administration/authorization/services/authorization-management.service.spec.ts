import { AuthorizationPlatform } from '../enums/authorization-platform.enum';
import { AuthorizationManagementCoreService } from './authorization-management.service';
import { createAuthorizationContext } from '../context/authorization-context';

describe('AuthorizationManagementCoreService', () => {
  it('advertises all independent management platforms', () => {
    const service = new AuthorizationManagementCoreService({} as never);
    expect(service.platforms().items.map((item) => item.platform)).toEqual([
      AuthorizationPlatform.MARKETPLACE,
      AuthorizationPlatform.PROVIDER,
      AuthorizationPlatform.ADMINISTRATION,
    ]);
  });

  it('rejects malformed role codes before opening a database transaction', async () => {
    const transaction = jest.fn();
    const service = new AuthorizationManagementCoreService({
      transaction,
    } as never);

    await expect(
      service.createRole(
        createAuthorizationContext(AuthorizationPlatform.PROVIDER),
        { code: 'not-valid', name: 'Invalid role', permissionIds: [] },
        'admin-1',
        'request-1',
      ),
    ).rejects.toThrow();
    expect(transaction).not.toHaveBeenCalled();
  });
});
