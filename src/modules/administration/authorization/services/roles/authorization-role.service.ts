import { Injectable } from '@nestjs/common';

import type {
  AuthorizationRoleDetail,
  AuthorizationRoleListResult,
} from '../../types/contracts/authorization-role.contract';
import type { AuthorizationRoleListQueryDto } from '../../dto/authorization-management.dto';
import { AuthorizationPlatform } from '../../enums/authorization-platform.enum';
import { AuthorizationRoleRepository } from '../../repositories/roles/authorization-role.repository';

@Injectable()
export class AuthorizationRoleService {
  constructor(private readonly repository: AuthorizationRoleRepository) {}

  list(
    platform: AuthorizationPlatform,
    query: AuthorizationRoleListQueryDto,
  ): Promise<AuthorizationRoleListResult> {
    return this.repository.list(platform, query);
  }

  get(
    platform: AuthorizationPlatform,
    roleId: string,
  ): Promise<AuthorizationRoleDetail> {
    return this.repository.findById(platform, roleId);
  }
}
