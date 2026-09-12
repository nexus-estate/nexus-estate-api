/** Permissions owned by the internal administration platform. */
export const ADMINISTRATION_PERMISSIONS = {
  ADMIN_PORTAL_ACCESS: 'admin-portal:access',
  PROVIDER_ACCOUNT_READ: 'provider-account:read',
  PROVIDER_ACCOUNT_APPROVE: 'provider-account:approve',
  PROVIDER_ACCOUNT_SUSPEND: 'provider-account:suspend',
  PROVIDER_ACCOUNT_REJECT: 'provider-account:reject',
  METRICS_READ: 'metrics:read',
  AUTHORIZATION_PLATFORM_READ: 'authorization:platform:read',
  AUTHORIZATION_ROLE_READ: 'authorization:role:read',
  AUTHORIZATION_ROLE_WRITE: 'authorization:role:write',
  AUTHORIZATION_PERMISSION_READ: 'authorization:permission:read',
  AUTHORIZATION_ASSIGNMENT_READ: 'authorization:assignment:read',
  AUTHORIZATION_ASSIGNMENT_WRITE: 'authorization:assignment:write',
  AUTHORIZATION_AUDIT_READ: 'authorization:audit:read',
} as const;

export type AdministrationPermissionCode =
  (typeof ADMINISTRATION_PERMISSIONS)[keyof typeof ADMINISTRATION_PERMISSIONS];
