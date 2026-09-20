import type {
  AuthorizationRoleListQueryDto,
  AuthorizationPermissionListQueryDto,
  AuthorizationSubjectListQueryDto,
  CreateAuthorizationRoleDto,
  ReplaceRolePermissionsDto,
  ReplaceSubjectRolesDto,
  UpdateAuthorizationRoleDto,
} from '../../dto/authorization-management.dto';
import type { AuthorizationMatrixResult } from './authorization-matrix.contract';
import type {
  AuthorizationPermissionDetail,
  AuthorizationPermissionListResult,
  AuthorizationPermissionRolesResult,
} from './authorization-permission.contract';
import type {
  AuthorizationRoleDeletionResult,
  AuthorizationRoleDetail,
  AuthorizationRoleListResult,
  AuthorizationRoleSubjectsResult,
} from './authorization-role.contract';
import type {
  AuthorizationSubjectDetail,
  AuthorizationSubjectListResult,
} from './authorization-subject.contract';

export interface AuthorizationOperations {
  readonly roles: {
    list(
      query: AuthorizationRoleListQueryDto,
    ): Promise<AuthorizationRoleListResult>;
    get(roleId: string): Promise<AuthorizationRoleDetail>;
    create(
      dto: CreateAuthorizationRoleDto,
      actor: string,
      requestId: string | null,
    ): Promise<AuthorizationRoleDetail>;
    update(
      roleId: string,
      dto: UpdateAuthorizationRoleDto,
      actor: string,
      requestId: string | null,
    ): Promise<AuthorizationRoleDetail>;
    delete(
      roleId: string,
      actor: string,
      requestId: string | null,
    ): Promise<AuthorizationRoleDeletionResult>;
    replacePermissions(
      roleId: string,
      dto: ReplaceRolePermissionsDto,
      actor: string,
      requestId: string | null,
    ): Promise<AuthorizationRoleDetail>;
  };

  readonly permissions: {
    list(
      query: AuthorizationPermissionListQueryDto,
    ): Promise<AuthorizationPermissionListResult>;
    get(permissionId: string): Promise<AuthorizationPermissionDetail>;
    roles(permissionId: string): Promise<AuthorizationPermissionRolesResult>;
  };

  readonly subjects: {
    list(
      query: AuthorizationSubjectListQueryDto,
    ): Promise<AuthorizationSubjectListResult>;
    get(subjectId: string): Promise<AuthorizationSubjectDetail>;
    listForRole(
      roleId: string,
      query: AuthorizationSubjectListQueryDto,
    ): Promise<AuthorizationRoleSubjectsResult>;
    replaceRoles(
      subjectId: string,
      dto: ReplaceSubjectRolesDto,
      actor: string,
      requestId: string | null,
    ): Promise<AuthorizationSubjectDetail>;
  };

  matrix(): Promise<AuthorizationMatrixResult>;
}
