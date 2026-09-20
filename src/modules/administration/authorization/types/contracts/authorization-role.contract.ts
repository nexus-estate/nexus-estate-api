import type { PaginatedResult } from '../../../../../services/abstraction-services/interfaces/pagination.interface';
import type { AuthorizationRoleStatus } from '../../enums/authorization-platform.enum';
import type { AuthorizationPermissionSummary } from './authorization-permission.contract';
import type {
  AuthorizationSubjectListResult,
  AuthorizationSubjectSummary,
} from './authorization-subject.contract';

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

export interface AuthorizationRoleDetail extends AuthorizationRoleSummary {
  permissions: AuthorizationPermissionSummary[];
}

export interface AuthorizationRoleDeletionResult {
  id: string;
  deleted: true;
}

export type AuthorizationRoleListResult =
  PaginatedResult<AuthorizationRoleSummary>;

export interface AuthorizationRoleSubjectsResult {
  role: AuthorizationRoleDetail;
  items: AuthorizationSubjectSummary[];
  meta: AuthorizationSubjectListResult['meta'];
}
