import { Injectable } from '@nestjs/common';
import { AuthorizationPlatform } from '../enums/authorization-platform.enum';
import { AuthorizationManagementCoreService } from '../services/authorization-management.service';
import type { PlatformAuthorizationManagementPort } from '../management/platform-authorization-management.port';
import type {
  AuthorizationPermissionListQueryDto,
  AuthorizationRoleListQueryDto,
  AuthorizationSubjectListQueryDto,
  CreateAuthorizationRoleDto,
  ReplaceRolePermissionsDto,
  ReplaceSubjectRolesDto,
  UpdateAuthorizationRoleDto,
} from '../dto/authorization-management.dto';

/** Marketplace adapter: customer subjects and marketplace-owned tables. */
@Injectable()
export class MarketplaceAuthorizationManagementAdapter implements PlatformAuthorizationManagementPort {
  platform: AuthorizationPlatform = AuthorizationPlatform.MARKETPLACE;

  constructor(private readonly core: AuthorizationManagementCoreService) {}

  /** Configures the neutral operations delegate for a concrete platform adapter. */
  forPlatform(platform: AuthorizationPlatform): this {
    this.platform = platform;
    return this;
  }

  /** Lists Marketplace roles through the platform-owned core. */
  listRoles(query: AuthorizationRoleListQueryDto) {
    return this.core.listRoles(this.platform, query);
  }
  /** Loads one exact Marketplace role. */
  getRole(roleId: string) {
    return this.core.getRole(this.platform, roleId);
  }
  /** Creates one Marketplace custom role. */
  createRole(
    dto: CreateAuthorizationRoleDto,
    actor: string,
    requestId: string | null,
  ) {
    return this.core.createRole(this.platform, dto, actor, requestId);
  }
  /** Updates one Marketplace role with version and invariant checks. */
  updateRole(
    roleId: string,
    dto: UpdateAuthorizationRoleDto,
    actor: string,
    requestId: string | null,
  ) {
    return this.core.updateRole(this.platform, roleId, dto, actor, requestId);
  }
  /** Soft-deletes one unused Marketplace role. */
  deleteRole(roleId: string, actor: string, requestId: string | null) {
    return this.core.deleteRole(this.platform, roleId, actor, requestId);
  }
  /** Replaces a Marketplace role's complete permission set. */
  replaceRolePermissions(
    roleId: string,
    dto: ReplaceRolePermissionsDto,
    actor: string,
    requestId: string | null,
  ) {
    return this.core.replaceRolePermissions(
      this.platform,
      roleId,
      dto,
      actor,
      requestId,
    );
  }
  /** Lists Marketplace permissions. */
  listPermissions(query: AuthorizationPermissionListQueryDto) {
    return this.core.listPermissions(this.platform, query);
  }
  /** Loads one exact Marketplace permission. */
  getPermission(permissionId: string) {
    return this.core.getPermission(this.platform, permissionId);
  }
  /** Lists Marketplace roles using one permission. */
  permissionRoles(permissionId: string) {
    return this.core.permissionRoles(this.platform, permissionId);
  }
  /** Builds the Marketplace role-permission matrix. */
  matrix() {
    return this.core.matrix(this.platform);
  }
  /** Lists Marketplace customer subjects, optionally filtered by role. */
  listSubjects(query: AuthorizationSubjectListQueryDto, roleId?: string) {
    return this.core.listSubjects(this.platform, query, roleId);
  }
  /** Loads one exact Marketplace customer subject. */
  getSubject(subjectId: string) {
    return this.core.getSubject(this.platform, subjectId);
  }
  /** Replaces one Marketplace customer's complete role set. */
  replaceSubjectRoles(
    subjectId: string,
    dto: ReplaceSubjectRolesDto,
    actor: string,
    requestId: string | null,
  ) {
    return this.core.replaceSubjectRoles(
      this.platform,
      subjectId,
      dto,
      actor,
      requestId,
    );
  }
}
