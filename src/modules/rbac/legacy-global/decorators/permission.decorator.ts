import { SetMetadata } from '@nestjs/common';
import type { PermissionName } from '../../../../utils';

export const PERMISSION_KEY = 'permission_key';

type PermissionRequirement = {
  mode: 'all' | 'any';
  permissions: PermissionName[];
};

/** Requires one specific permission. */
export const PermissionRequire = (permission: PermissionName) =>
  SetMetadata(PERMISSION_KEY, {
    mode: 'all',
    permissions: [permission],
  } satisfies PermissionRequirement);

/** Allows access when the principal has any one of the supplied permissions. */
export const AnyPermissionsRequire = (...permissions: PermissionName[]) =>
  SetMetadata(PERMISSION_KEY, {
    mode: 'any',
    permissions,
  } satisfies PermissionRequirement);

/** @deprecated Use PermissionRequire or AnyPermissionsRequire explicitly. */
export const Permissions = (...permissions: PermissionName[]) =>
  SetMetadata(PERMISSION_KEY, {
    mode: 'all',
    permissions,
  } satisfies PermissionRequirement);
