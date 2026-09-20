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
import { type AuthorizationContext } from '../../context/authorization-context';
import { AuthorizationManagementCoreService } from '../authorization-management.service';
import { AuthorizationRoleRepository } from '../../repositories/roles/authorization-role.repository';

@Injectable()
/** Role mutation facade that preserves core transaction and invariant behavior. */
export class AuthorizationRoleCommandService {
  constructor(
    private readonly core: AuthorizationManagementCoreService,
    private readonly repository: AuthorizationRoleRepository,
  ) {}

  /** Creates a role and returns its persisted detail. */
  async create(
    context: AuthorizationContext,
    dto: CreateAuthorizationRoleDto,
    actor: string,
    requestId: string | null,
  ): Promise<AuthorizationRoleDetail> {
    const roleId = await this.core.createRole(context, dto, actor, requestId);
    return await this.repository.findById(context, roleId);
  }

  /** Updates role metadata and returns the updated detail. */
  async update(
    context: AuthorizationContext,
    roleId: string,
    dto: UpdateAuthorizationRoleDto,
    actor: string,
    requestId: string | null,
  ): Promise<AuthorizationRoleDetail> {
    const updatedRoleId = await this.core.updateRole(
      context,
      roleId,
      dto,
      actor,
      requestId,
    );
    return await this.repository.findById(context, updatedRoleId);
  }

  /** Deletes a role when the authorization invariants permit it. */
  delete(
    context: AuthorizationContext,
    roleId: string,
    actor: string,
    requestId: string | null,
  ): Promise<AuthorizationRoleDeletionResult> {
    return this.core.deleteRole(context, roleId, actor, requestId);
  }

  /** Replaces a role's permissions and returns the updated detail. */
  async replacePermissions(
    context: AuthorizationContext,
    roleId: string,
    dto: ReplaceRolePermissionsDto,
    actor: string,
    requestId: string | null,
  ): Promise<AuthorizationRoleDetail> {
    const updatedRoleId = await this.core.replaceRolePermissions(
      context,
      roleId,
      dto,
      actor,
      requestId,
    );
    return await this.repository.findById(context, updatedRoleId);
  }
}
