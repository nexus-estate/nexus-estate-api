import { SetMetadata } from '@nestjs/common';
import { PermissionName } from '../../../utils';

export const PERMISSION_KEY = 'permission_key';

export const Permissions = (...permission: PermissionName[]) => {
  return SetMetadata(PERMISSION_KEY, permission);
};
