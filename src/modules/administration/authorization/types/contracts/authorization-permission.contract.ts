import type { PaginatedResult } from '../../../../../services/abstraction-services/interfaces/pagination.interface';
import type { AuthorizationPermissionSummary } from './authorization-role.contract';

export interface AuthorizationPermissionRoleReference {
  id: string;
  code: string;
  name: string;
}

export interface AuthorizationPermissionDetail extends AuthorizationPermissionSummary {
  rolesUsingCount: number;
  rolesUsing: AuthorizationPermissionRoleReference[];
}

export type AuthorizationPermissionListResult =
  PaginatedResult<AuthorizationPermissionSummary>;

export interface AuthorizationPermissionRolesResult {
  items: AuthorizationPermissionRoleReference[];
}
