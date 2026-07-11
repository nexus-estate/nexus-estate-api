import { SetMetadata } from '@nestjs/common';
import { RoleName } from '../../../utils/constants/role.constant';

export const ROLES_KEY = 'roles';
export const ROLES_REQUIRED = (...roles: RoleName[]) =>
  SetMetadata(ROLES_KEY, roles);
