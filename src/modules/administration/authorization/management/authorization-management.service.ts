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
import type {
  AuthorizationRoleDetail,
  AuthorizationRoleDeletionResult,
  AuthorizationRoleListResult,
  AuthorizationRoleSubjectsResult,
  AuthorizationSubjectListResult,
} from '../types/contracts/authorization-role.contract';
import type {
  AuthorizationPermissionDetail,
  AuthorizationPermissionListResult,
  AuthorizationPermissionRolesResult,
} from '../types/contracts/authorization-permission.contract';
import type { AuthorizationSubjectDetail } from '../types/contracts/authorization-subject.contract';
import type { AuthorizationMatrixResult } from '../types/contracts/authorization-matrix.contract';
import type {
  AuthorizationAuditResult,
  AuthorizationPlatformsResult,
  AuthorizationProviderMemberListResult,
} from '../types/contracts/authorization-management.contract';

/** Thin HTTP-facing facade over platform-owned authorization management adapters. */
@Injectable()
export class AuthorizationManagementService {
  constructor(private readonly core: AuthorizationManagementCoreService) {}

  /** Returns normalized platform metadata for management screens. */
  platforms(): AuthorizationPlatformsResult {
    return this.core.platforms();
  }
  /** Delegates bounded audit search to the audit-aware core service. */
  audit(query: AuthorizationAuditQueryDto): Promise<AuthorizationAuditResult> {
    return this.core.audit(query);
  }
  /** Lists memberships for one exact provider identifier. */
  providerMembers(
    providerId: string,
    query: AuthorizationSubjectListQueryDto,
  ): Promise<AuthorizationProviderMemberListResult> {
    return this.core.providerMembers(providerId, query);
  }
  /** Lists roles directly through the typed SQL kernel for the selected platform. */
  listRoles(
    platform: AuthorizationPlatform,
    query: AuthorizationRoleListQueryDto,
  ): Promise<AuthorizationRoleListResult> {
    return this.core.listRoles(platform, query);
  }
  /** Loads one exact role directly through the typed SQL kernel. */
  getRole(
    platform: AuthorizationPlatform,
    roleId: string,
  ): Promise<AuthorizationRoleDetail> {
    return this.core.getRole(platform, roleId);
  }
  /** Creates a role in the selected platform. */
  createRole(
    platform: AuthorizationPlatform,
    dto: CreateAuthorizationRoleDto,
    actor: string,
    requestId: string | null,
  ): Promise<AuthorizationRoleDetail> {
    return this.core.createRole(platform, dto, actor, requestId);
  }
  /** Updates one versioned role in the selected platform. */
  updateRole(
    platform: AuthorizationPlatform,
    roleId: string,
    dto: UpdateAuthorizationRoleDto,
    actor: string,
    requestId: string | null,
  ): Promise<AuthorizationRoleDetail> {
    return this.core.updateRole(platform, roleId, dto, actor, requestId);
  }
  /** Soft-deletes one eligible role in the selected platform. */
  deleteRole(
    platform: AuthorizationPlatform,
    roleId: string,
    actor: string,
    requestId: string | null,
  ): Promise<AuthorizationRoleDeletionResult> {
    return this.core.deleteRole(platform, roleId, actor, requestId);
  }
  /** Replaces one role's permission set in the selected platform. */
  replaceRolePermissions(
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
  /** Selects the platform adapter and lists its permission catalogue. */
  listPermissions(
    platform: AuthorizationPlatform,
    query: AuthorizationPermissionListQueryDto,
  ): Promise<AuthorizationPermissionListResult> {
    return this.core.listPermissions(platform, query);
  }
  /** Selects the platform adapter and loads one exact permission. */
  getPermission(
    platform: AuthorizationPlatform,
    permissionId: string,
  ): Promise<AuthorizationPermissionDetail> {
    return this.core.getPermission(platform, permissionId);
  }
  /** Selects the platform adapter and lists roles using one permission. */
  permissionRoles(
    platform: AuthorizationPlatform,
    permissionId: string,
  ): Promise<AuthorizationPermissionRolesResult> {
    return this.core.permissionRoles(platform, permissionId);
  }
  /** Builds the normalized matrix for the selected platform. */
  matrix(platform: AuthorizationPlatform): Promise<AuthorizationMatrixResult> {
    return this.core.matrix(platform);
  }
  /** Selects the platform adapter and lists its exact subject domain. */
  listSubjects(
    platform: AuthorizationPlatform,
    query: AuthorizationSubjectListQueryDto,
  ): Promise<AuthorizationSubjectListResult> {
    return this.core.listSubjects(platform, query);
  }
  /** Selects the platform adapter and lists assignments for one role. */
  roleSubjects(
    platform: AuthorizationPlatform,
    roleId: string,
    query: AuthorizationSubjectListQueryDto,
  ): Promise<AuthorizationRoleSubjectsResult> {
    return this.core.roleSubjects(platform, roleId, query);
  }
  /** Selects the platform adapter and loads one exact subject. */
  getSubject(
    platform: AuthorizationPlatform,
    subjectId: string,
  ): Promise<AuthorizationSubjectDetail> {
    return this.core.getSubject(platform, subjectId);
  }
  /** Replaces one subject's role set in the selected platform. */
  replaceSubjectRoles(
    platform: AuthorizationPlatform,
    subjectId: string,
    dto: ReplaceSubjectRolesDto,
    actor: string,
    requestId: string | null,
  ): Promise<AuthorizationSubjectDetail> {
    return this.core.replaceSubjectRoles(
      platform,
      subjectId,
      dto,
      actor,
      requestId,
    );
  }
}
