import { Injectable } from '@nestjs/common';

import type {
  AuthorizationRoleDetail,
  AuthorizationRoleDeletionResult,
} from '../../types/contracts/authorization-role.contract';
import type {
  CreateAuthorizationRoleDto,
  ReplaceRolePermissionsDto,
  UpdateAuthorizationRoleDto,
} from '../../dto/authorization-management.dto';
import { AuthorizationPlatform } from '../../enums/authorization-platform.enum';
import { AuthorizationManagementCoreService } from '../authorization-management.service';

@Injectable()
export class AuthorizationRoleCommandService {
  constructor(private readonly core: AuthorizationManagementCoreService) {}

  create(
    platform: AuthorizationPlatform,
    dto: CreateAuthorizationRoleDto,
    actor: string,
    requestId: string | null,
  ): Promise<AuthorizationRoleDetail> {
    return this.core.createRole(platform, dto, actor, requestId);
  }

  update(
    platform: AuthorizationPlatform,
    roleId: string,
    dto: UpdateAuthorizationRoleDto,
    actor: string,
    requestId: string | null,
  ): Promise<AuthorizationRoleDetail> {
    return this.core.updateRole(platform, roleId, dto, actor, requestId);
  }

  delete(
    platform: AuthorizationPlatform,
    roleId: string,
    actor: string,
    requestId: string | null,
  ): Promise<AuthorizationRoleDeletionResult> {
    return this.core.deleteRole(platform, roleId, actor, requestId);
  }

  replacePermissions(
    platform: AuthorizationPlatform,
    roleId: string,
    dto: ReplaceRolePermissionsDto,
    actor: string,
    requestId: string | null,
  ): Promise<AuthorizationRoleDetail> {
    return this.core.replaceRolePermissions(
      platform,
      roleId,
      dto,
      actor,
      requestId,
    );
  }
}
