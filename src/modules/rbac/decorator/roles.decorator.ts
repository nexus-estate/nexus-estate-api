import { SetMetadata } from '@nestjs/common';
import type { RoleName } from '../../../utils';

export const ROLE_KEY = 'roles';

/** Requires one specific persisted role. */
export const RoleRequire = (role: RoleName) => SetMetadata(ROLE_KEY, [role]);

/** Allows access when the principal has any one of the supplied roles. */
export const AnyRolesRequire = (...roles: RoleName[]) =>
  SetMetadata(ROLE_KEY, roles);

/** @deprecated Use RoleRequire or AnyRolesRequire for explicit semantics. */
export const Role = (...roles: RoleName[]) => AnyRolesRequire(...roles);
