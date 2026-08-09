import { SetMetadata } from '@nestjs/common';
import { PermissionName } from '../../../utils/constants/permission.constant';

export const PERMISSIONS_KEY = 'permissions';
export const PERMISSIONS_REQUIRED = (...permissions: PermissionName[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);
