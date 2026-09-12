import type { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { PermissionsGuard } from './permission.guard';
import { PERMISSIONS } from '../../../utils/constants/permission.constant';

function createContext(): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({
        user: {
          id: 'user-id',
          email: 'user@nexus.test',
          roleId: 'role-id',
          role: 'provider',
        },
      }),
    }),
    getHandler: jest.fn(),
    getClass: jest.fn(),
  } as unknown as ExecutionContext;
}

const providerRole = {
  rolePermissions: [
    { permission: { name: PERMISSIONS.ESTATE_READ } },
    { permission: { name: PERMISSIONS.MEDIA_READ } },
  ],
};

describe('PermissionsGuard', () => {
  it('requires every permission for PermissionRequire metadata', async () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue({
        mode: 'all',
        permissions: [PERMISSIONS.ESTATE_READ, PERMISSIONS.MEDIA_READ],
      }),
    } as unknown as Reflector;
    const roleService = {
      findByIdWithPermissions: jest.fn().mockResolvedValue(providerRole),
    };
    const guard = new PermissionsGuard(reflector, roleService as never);

    await expect(guard.canActivate(createContext())).resolves.toBe(true);
  });

  it('requires any permission for AnyPermissionsRequire metadata', async () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue({
        mode: 'any',
        permissions: [PERMISSIONS.ESTATE_DELETE, PERMISSIONS.MEDIA_READ],
      }),
    } as unknown as Reflector;
    const roleService = {
      findByIdWithPermissions: jest.fn().mockResolvedValue(providerRole),
    };
    const guard = new PermissionsGuard(reflector, roleService as never);

    await expect(guard.canActivate(createContext())).resolves.toBe(true);
  });
});
