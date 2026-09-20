import type { PaginatedResult } from '../../../../../services/abstraction-services/interfaces/pagination.interface';
import type { AuthorizationPermissionSummary } from './authorization-permission.contract';

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

export interface AuthorizationSubjectRoleReference {
  id: string;
  code: string;
  name: string;
  status: string;
}

export interface AuthorizationSubjectDetail extends AuthorizationSubjectSummary {
  roles: AuthorizationSubjectRoleReference[];
  permissions: AuthorizationPermissionSummary[];
  provider_id?: string;
  provider_display_name?: string;
  customer_id?: string;
  customer_email?: string;
}
