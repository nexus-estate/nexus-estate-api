import { Injectable } from '@nestjs/common';
import type {
  AuthorizationAuditQueryDto,
  AuthorizationPermissionListQueryDto,
  AuthorizationRoleListQueryDto,
  AuthorizationSubjectListQueryDto,
  CreateAuthorizationRoleDto,
  ReplaceRolePermissionsDto,
  ReplaceSubjectRolesDto,
  UpdateAuthorizationRoleDto,
} from '../dto/authorization-management.dto';
import { AuthorizationPlatform } from '../enums/authorization-platform.enum';
import { AuthorizationManagementCoreService } from '../services/authorization-management.service';
import { PlatformAuthorizationAdapterRegistry } from './platform-adapter.registry';

/** Thin HTTP-facing facade over platform-owned authorization management adapters. */
@Injectable()
export class AuthorizationManagementService {
  constructor(
    private readonly adapters: PlatformAuthorizationAdapterRegistry,
    private readonly core: AuthorizationManagementCoreService,
  ) {}

  /** Returns normalized platform metadata for management screens. */
  platforms() {
    return this.core.platforms();
  }
  /** Delegates bounded audit search to the audit-aware core service. */
  audit(query: AuthorizationAuditQueryDto) {
    return this.core.audit(query);
  }
  /** Lists memberships for one exact provider identifier. */
  providerMembers(providerId: string, query: AuthorizationSubjectListQueryDto) {
    return this.core.providerMembers(providerId, query);
  }
  /** Selects the platform adapter and lists its roles. */
  listRoles(
    platform: AuthorizationPlatform,
    query: AuthorizationRoleListQueryDto,
  ) {
    return this.adapters.for(platform).listRoles(query);
  }
  /** Selects the platform adapter and loads one exact role. */
  getRole(platform: AuthorizationPlatform, roleId: string) {
    return this.adapters.for(platform).getRole(roleId);
  }
  /** Selects the platform adapter and creates a role in that platform. */
  createRole(
    platform: AuthorizationPlatform,
    dto: CreateAuthorizationRoleDto,
    actor: string,
    requestId: string | null,
  ) {
    return this.adapters.for(platform).createRole(dto, actor, requestId);
  }
  /** Selects the platform adapter and updates one versioned role. */
  updateRole(
    platform: AuthorizationPlatform,
    roleId: string,
    dto: UpdateAuthorizationRoleDto,
    actor: string,
    requestId: string | null,
  ) {
    return this.adapters
      .for(platform)
      .updateRole(roleId, dto, actor, requestId);
  }
  /** Selects the platform adapter and soft-deletes one eligible role. */
  deleteRole(
    platform: AuthorizationPlatform,
    roleId: string,
    actor: string,
    requestId: string | null,
  ) {
    return this.adapters.for(platform).deleteRole(roleId, actor, requestId);
  }
  /** Selects the platform adapter and replaces one role's permission set. */
  replaceRolePermissions(
    platform: AuthorizationPlatform,
    roleId: string,
    dto: ReplaceRolePermissionsDto,
    actor: string,
    requestId: string | null,
  ) {
    return this.adapters
      .for(platform)
      .replaceRolePermissions(roleId, dto, actor, requestId);
  }
  /** Selects the platform adapter and lists its permission catalogue. */
  listPermissions(
    platform: AuthorizationPlatform,
    query: AuthorizationPermissionListQueryDto,
  ) {
    return this.adapters.for(platform).listPermissions(query);
  }
  /** Selects the platform adapter and loads one exact permission. */
  getPermission(platform: AuthorizationPlatform, permissionId: string) {
    return this.adapters.for(platform).getPermission(permissionId);
  }
  /** Selects the platform adapter and lists roles using one permission. */
  permissionRoles(platform: AuthorizationPlatform, permissionId: string) {
    return this.adapters.for(platform).permissionRoles(permissionId);
  }
  /** Selects the platform adapter and builds its normalized matrix. */
  matrix(platform: AuthorizationPlatform) {
    return this.adapters.for(platform).matrix();
  }
  /** Selects the platform adapter and lists its exact subject domain. */
  listSubjects(
    platform: AuthorizationPlatform,
    query: AuthorizationSubjectListQueryDto,
  ) {
    return this.adapters.for(platform).listSubjects(query);
  }
  /** Selects the platform adapter and lists assignments for one role. */
  roleSubjects(
    platform: AuthorizationPlatform,
    roleId: string,
    query: AuthorizationSubjectListQueryDto,
  ) {
    return this.adapters.for(platform).listSubjects(query, roleId);
  }
  /** Selects the platform adapter and loads one exact subject. */
  getSubject(platform: AuthorizationPlatform, subjectId: string) {
    return this.adapters.for(platform).getSubject(subjectId);
  }
  /** Selects the platform adapter and replaces one subject's role set. */
  replaceSubjectRoles(
    platform: AuthorizationPlatform,
    subjectId: string,
    dto: ReplaceSubjectRolesDto,
    actor: string,
    requestId: string | null,
  ) {
    return this.adapters
      .for(platform)
      .replaceSubjectRoles(subjectId, dto, actor, requestId);
  }
}
