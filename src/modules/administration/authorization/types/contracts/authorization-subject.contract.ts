import type { AuthorizationPermissionSummary } from './authorization-role.contract';
import type { AuthorizationSubjectSummary } from './authorization-role.contract';

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
