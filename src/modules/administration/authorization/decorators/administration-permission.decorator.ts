import { SetMetadata } from '@nestjs/common';
import type { AdministrationPermissionCode } from '../constants/administration-permission.constant';

export const ADMINISTRATION_PERMISSION_KEY =
  'administration_permission_requirement';

export type AdministrationPermissionRequirement = {
  mode: 'all' | 'any';
  permissions: AdministrationPermissionCode[];
};

/** Requires one current administration permission. */
export const AdministrationPermissionRequire = (
  permission: AdministrationPermissionCode,
) =>
  SetMetadata(ADMINISTRATION_PERMISSION_KEY, {
    mode: 'all',
    permissions: [permission],
  } satisfies AdministrationPermissionRequirement);

/** Allows access when the administrator has any supplied permission. */
export const AnyAdministrationPermissionsRequire = (
  ...permissions: AdministrationPermissionCode[]
) =>
  SetMetadata(ADMINISTRATION_PERMISSION_KEY, {
    mode: 'any',
    permissions,
  } satisfies AdministrationPermissionRequirement);
