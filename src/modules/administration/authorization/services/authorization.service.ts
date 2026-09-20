import { Injectable } from '@nestjs/common';

import { AuthorizationContextResolver } from '../context/authorization-context.resolver';
import { AuthorizationPlatform } from '../enums/authorization-platform.enum';
import { AuthorizationManagementService } from '../management/authorization-management.service';
import { AuthorizationPermissionService } from './permissions/authorization-permission.service';
import { AuthorizationRoleCommandService } from './roles/authorization-role-command.service';
import { AuthorizationRoleService } from './roles/authorization-role.service';
import { AuthorizationRoleSubjectService } from './subjects/authorization-role-subject.service';
import { AuthorizationSubjectService } from './subjects/authorization-subject.service';
import type { AuthorizationOperations } from '../types/contracts/authorization-operations.contract';

@Injectable()
/**
 * Application entry point for creating immutable platform-bound operations.
 *
 * This singleton stores only stateless service dependencies. It never stores a
 * current platform, making bound operations safe to use concurrently.
 */
export class AuthorizationService {
  constructor(
    private readonly contextResolver: AuthorizationContextResolver,
    private readonly roleService: AuthorizationRoleService,
    private readonly roleCommandService: AuthorizationRoleCommandService,
    private readonly permissionService: AuthorizationPermissionService,
    private readonly subjectService: AuthorizationSubjectService,
    private readonly roleSubjectService: AuthorizationRoleSubjectService,
    private readonly managementService: AuthorizationManagementService,
  ) {}

  /**
   * Creates a new operations object bound to one platform.
   *
   * @param platform Platform to bind to the returned scope.
   * @returns A new immutable operations object using the selected platform.
   * @throws BusinessException When the platform is unsupported.
   */
  for(platform: AuthorizationPlatform): AuthorizationOperations {
    const context = this.contextResolver.resolve(platform);

    const operations: AuthorizationOperations = {
      roles: Object.freeze({
        list: (query) => this.roleService.list(context, query),
        get: (roleId) => this.roleService.get(context, roleId),
        create: (dto, actor, requestId) =>
          this.roleCommandService.create(context, dto, actor, requestId),
        update: (roleId, dto, actor, requestId) =>
          this.roleCommandService.update(
            context,
            roleId,
            dto,
            actor,
            requestId,
          ),
        delete: (roleId, actor, requestId) =>
          this.roleCommandService.delete(context, roleId, actor, requestId),
        replacePermissions: (roleId, dto, actor, requestId) =>
          this.roleCommandService.replacePermissions(
            context,
            roleId,
            dto,
            actor,
            requestId,
          ),
      }),
      permissions: Object.freeze({
        list: (query) => this.permissionService.list(context, query),
        get: (permissionId) =>
          this.permissionService.get(context, permissionId),
        roles: (permissionId) =>
          this.permissionService.roles(context, permissionId),
      }),
      subjects: Object.freeze({
        list: (query) => this.subjectService.list(context, query),
        get: (subjectId) => this.subjectService.get(context, subjectId),
        listForRole: (roleId, query) =>
          this.roleSubjectService.listForRole(context, roleId, query),
        replaceRoles: (subjectId, dto, actor, requestId) =>
          this.roleSubjectService.replaceRoles(
            context,
            subjectId,
            dto,
            actor,
            requestId,
          ),
      }),
      matrix: () => this.managementService.matrix(context),
    };

    return Object.freeze(operations);
  }
}
