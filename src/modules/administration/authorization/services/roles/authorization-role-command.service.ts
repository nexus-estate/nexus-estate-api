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
import { AuthorizationRoleRepository } from '../../repositories/roles/authorization-role.repository';

@Injectable()
export class AuthorizationRoleCommandService {
  constructor(
    private readonly core: AuthorizationManagementCoreService,
    private readonly repository: AuthorizationRoleRepository,
  ) {}

  create(
    platform: AuthorizationPlatform,
    dto: CreateAuthorizationRoleDto,
    actor: string,
    requestId: string | null,
  ): Promise<AuthorizationRoleDetail> {
    return this.core
      .createRole(platform, dto, actor, requestId)
      .then((roleId) => this.repository.findById(platform, roleId));
  }

  update(
    platform: AuthorizationPlatform,
    roleId: string,
    dto: UpdateAuthorizationRoleDto,
    actor: string,
    requestId: string | null,
  ): Promise<AuthorizationRoleDetail> {
    return this.core
      .updateRole(platform, roleId, dto, actor, requestId)
      .then((updatedRoleId) =>
        this.repository.findById(platform, updatedRoleId),
      );
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
    return this.core
      .replaceRolePermissions(platform, roleId, dto, actor, requestId)
      .then((updatedRoleId) =>
        this.repository.findById(platform, updatedRoleId),
      );
  }
}
