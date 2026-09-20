import type { PaginatedResult } from '../../../../../services/abstraction-services/interfaces/pagination.interface';
import type {
  AuthorizationPlatform,
  AuthorizationRoleStatus,
} from '../../enums/authorization-platform.enum';

export interface AuthorizationRoleAllowedActions {
  updateMetadata: boolean;
  updateStatus: boolean;
  updatePermissions: boolean;
  delete: boolean;
}

export interface AuthorizationRoleSummary {
  id: string;
  code: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  status: AuthorizationRoleStatus;
  version: number;
  permissionCount: number;
  assignmentCount: number;
  allowedActions: AuthorizationRoleAllowedActions;
  isEditable: boolean;
  isDeletable: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface AuthorizationPermissionSummary {
  id: string;
  code: string;
  name: string;
  description: string | null;
  platform: AuthorizationPlatform;
  category: string;
  resource: string;
  action: string;
  riskLevel: string;
  isAssignable: boolean;
  isDeprecated: boolean;
  deprecatedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface AuthorizationRoleDetail extends AuthorizationRoleSummary {
  permissions: AuthorizationPermissionSummary[];
}

export interface AuthorizationRoleDeletionResult {
  id: string;
  deleted: true;
}

export type AuthorizationRoleListResult =
  PaginatedResult<AuthorizationRoleSummary>;

export interface AuthorizationSubjectSummary {
  id: string;
  subjectType: string;
  displayName: string;
  secondaryText: string | null;
  status: string;
  roleCount: number;
  roleIds: string[];
}

export type AuthorizationSubjectListResult =
  PaginatedResult<AuthorizationSubjectSummary>;

export interface AuthorizationRoleSubjectsResult {
  role: AuthorizationRoleDetail;
  items: AuthorizationSubjectSummary[];
  meta: AuthorizationSubjectListResult['meta'];
}
