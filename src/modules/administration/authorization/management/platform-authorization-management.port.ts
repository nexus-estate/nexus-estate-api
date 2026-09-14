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
import type { AuthorizationPlatform } from '../enums/authorization-platform.enum';

/** Normalized management operations exposed by one platform adapter. */
export interface PlatformAuthorizationManagementPort {
  readonly platform: AuthorizationPlatform;
  listRoles(query: AuthorizationRoleListQueryDto): Promise<unknown>;
  getRole(roleId: string): Promise<unknown>;
  createRole(
    dto: CreateAuthorizationRoleDto,
    actorAdministratorId: string,
    requestId: string | null,
  ): Promise<unknown>;
  updateRole(
    roleId: string,
    dto: UpdateAuthorizationRoleDto,
    actorAdministratorId: string,
    requestId: string | null,
  ): Promise<unknown>;
  deleteRole(
    roleId: string,
    actorAdministratorId: string,
    requestId: string | null,
  ): Promise<unknown>;
  replaceRolePermissions(
    roleId: string,
    dto: ReplaceRolePermissionsDto,
    actorAdministratorId: string,
    requestId: string | null,
  ): Promise<unknown>;
  listPermissions(query: AuthorizationPermissionListQueryDto): Promise<unknown>;
  getPermission(permissionId: string): Promise<unknown>;
  permissionRoles(permissionId: string): Promise<unknown>;
  matrix(): Promise<unknown>;
  listSubjects(
    query: AuthorizationSubjectListQueryDto,
    roleId?: string,
  ): Promise<unknown>;
  getSubject(subjectId: string): Promise<unknown>;
  replaceSubjectRoles(
    subjectId: string,
    dto: ReplaceSubjectRolesDto,
    actorAdministratorId: string,
    requestId: string | null,
  ): Promise<unknown>;
}

/** Management-level audit query remains outside platform adapters. */
export type AuthorizationManagementAuditQuery = AuthorizationAuditQueryDto;
