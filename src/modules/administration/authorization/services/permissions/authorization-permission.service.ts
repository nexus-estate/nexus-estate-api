import { Injectable } from '@nestjs/common';

import type { AuthorizationPermissionListQueryDto } from '../../dto/authorization-management.dto';
import { AuthorizationPlatform } from '../../enums/authorization-platform.enum';
import type {
  AuthorizationPermissionDetail,
  AuthorizationPermissionListResult,
  AuthorizationPermissionRolesResult,
} from '../../types/contracts/authorization-permission.contract';
import { AuthorizationPermissionRepository } from '../../repositories/permissions/authorization-permission.repository';

@Injectable()
export class AuthorizationPermissionService {
  constructor(private readonly repository: AuthorizationPermissionRepository) {}

  list(
    platform: AuthorizationPlatform,
    query: AuthorizationPermissionListQueryDto,
  ): Promise<AuthorizationPermissionListResult> {
    return this.repository.list(platform, query);
  }

  get(
    platform: AuthorizationPlatform,
    permissionId: string,
  ): Promise<AuthorizationPermissionDetail> {
    return this.repository.findById(platform, permissionId);
  }

  roles(
    platform: AuthorizationPlatform,
    permissionId: string,
  ): Promise<AuthorizationPermissionRolesResult> {
    return this.repository.roles(platform, permissionId);
  }
}
