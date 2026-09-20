import type { PaginatedResult } from '../../../../../services/abstraction-services/interfaces/pagination.interface';
import type {
  AuthorizationPlatform,
  AuthorizationRiskLevel,
} from '../../enums/authorization-platform.enum';

export interface AuthorizationPermissionSummary {
  id: string;
  code: string;
  name: string;
  description: string | null;
  platform: AuthorizationPlatform;
  category: string;
  resource: string;
  action: string;
  riskLevel: AuthorizationRiskLevel;
  isAssignable: boolean;
  isDeprecated: boolean;
  deprecatedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

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
