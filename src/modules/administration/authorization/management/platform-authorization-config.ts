import { AuthorizationPlatform } from '../enums/authorization-platform.enum';

export type PlatformAuthorizationSqlConfig = {
  readonly roleTable: string;
  readonly permissionTable: string;
  readonly rolePermissionTable: string;
  readonly assignmentTable: string;
  readonly assignmentSubjectColumn: string;
  readonly subjectTable: string;
  readonly subjectType: 'CUSTOMER' | 'PROVIDER_MEMBERSHIP' | 'ADMINISTRATOR';
};

const configs: Record<AuthorizationPlatform, PlatformAuthorizationSqlConfig> = {
  [AuthorizationPlatform.MARKETPLACE]: {
    roleTable: 'tbl_marketplace_role',
    permissionTable: 'tbl_marketplace_permission',
    rolePermissionTable: 'tbl_marketplace_role_permission',
    assignmentTable: 'tbl_customer_role_assignment',
    assignmentSubjectColumn: 'customer_id',
    subjectTable: 'tbl_customer_account',
    subjectType: 'CUSTOMER',
  },
  [AuthorizationPlatform.PROVIDER]: {
    roleTable: 'tbl_provider_role',
    permissionTable: 'tbl_provider_permission',
    rolePermissionTable: 'tbl_provider_role_permission',
    assignmentTable: 'tbl_provider_membership_role',
    assignmentSubjectColumn: 'membership_id',
    subjectTable: 'tbl_provider_membership',
    subjectType: 'PROVIDER_MEMBERSHIP',
  },
  [AuthorizationPlatform.ADMINISTRATION]: {
    roleTable: 'tbl_administration_role',
    permissionTable: 'tbl_administration_permission',
    rolePermissionTable: 'tbl_administration_role_permission',
    assignmentTable: 'tbl_administrator_role_assignment',
    assignmentSubjectColumn: 'administrator_id',
    subjectTable: 'tbl_administrator_account',
    subjectType: 'ADMINISTRATOR',
  },
};

export const platformAuthorizationSqlConfigs = Object.values(configs);

export function platformAuthorizationSqlConfig(
  platform: AuthorizationPlatform,
): PlatformAuthorizationSqlConfig {
  return configs[platform];
}
