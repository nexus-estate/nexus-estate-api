import { SetMetadata } from '@nestjs/common';
import { RoleName } from '../../../utils';

export const ROLE_KEY = 'roles';

export const Role = (...role: RoleName[]) => {
  return SetMetadata(ROLE_KEY, role);
};
