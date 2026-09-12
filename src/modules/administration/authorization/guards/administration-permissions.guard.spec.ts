import { Reflector } from '@nestjs/core';

import type { AdministrationPrincipal } from '../../../../common/security/auth.types';
import { AdministrationPermissionsGuard } from './administration-permissions.guard';
import { AdministrationAuthorizationRepository } from '../repositories/administration-authorization.repository';

describe('AdministrationPermissionsGuard', () => {
  const principal: AdministrationPrincipal = {
    id: 'admin-id',
    email: 'admin@nexus.test',
    realm: 'administration',
  };

  const context = (user: unknown) => ({
    getHandler: jest.fn(),
    getClass: jest.fn(),
    switchToHttp: () => ({
      getRequest: () => ({ user }),
    }),
  });

  it('checks current scoped permission state for an administration principal', async () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue({
        mode: 'all',
        permissions: ['provider-account:approve'],
      }),
    } as unknown as Reflector;
    const hasPermission = jest.fn().mockResolvedValue(true);
    const repository = {
      hasPermission,
    } as unknown as AdministrationAuthorizationRepository;
    const guard = new AdministrationPermissionsGuard(reflector, repository);

    await expect(guard.canActivate(context(principal) as never)).resolves.toBe(
      true,
    );
    expect(hasPermission).toHaveBeenCalledWith(
      principal.id,
      'provider-account:approve',
    );
  });

  it('rejects a customer principal even when the permission code exists', async () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue({
        mode: 'all',
        permissions: ['provider-account:approve'],
      }),
    } as unknown as Reflector;
    const hasPermission = jest.fn().mockResolvedValue(true);
    const repository = {
      hasPermission,
    } as unknown as AdministrationAuthorizationRepository;
    const guard = new AdministrationPermissionsGuard(reflector, repository);

    await expect(
      guard.canActivate(context({ ...principal, realm: 'customer' }) as never),
    ).resolves.toBe(false);
    expect(hasPermission).not.toHaveBeenCalled();
  });

  it('denies access after the current permission is revoked', async () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue({
        mode: 'all',
        permissions: ['provider-account:approve'],
      }),
    } as unknown as Reflector;
    const hasPermission = jest.fn().mockResolvedValue(false);
    const repository = {
      hasPermission,
    } as unknown as AdministrationAuthorizationRepository;
    const guard = new AdministrationPermissionsGuard(reflector, repository);

    await expect(guard.canActivate(context(principal) as never)).resolves.toBe(
      false,
    );
  });
});
