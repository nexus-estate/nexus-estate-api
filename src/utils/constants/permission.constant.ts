export const PERMISSIONS = {
  // Customer profile
  CUSTOMER_PROFILE_READ: 'customer:profile:read',

  // Provider account
  PROVIDER_ACCOUNT_REGISTER: 'provider-account:register',
  PROVIDER_ACCOUNT_READ: 'provider-account:read',
  PROVIDER_ACCOUNT_UPDATE: 'provider-account:update',
  PROVIDER_ACCOUNT_APPROVE: 'provider-account:approve',
  PROVIDER_ACCOUNT_SUSPEND: 'provider-account:suspend',

  // Customer account administration
  CUSTOMER_ACCOUNT_CREATE: 'customer-account:create',
  CUSTOMER_ACCOUNT_READ: 'customer-account:read',
  CUSTOMER_ACCOUNT_UPDATE: 'customer-account:update',
  CUSTOMER_ACCOUNT_DELETE: 'customer-account:delete',
  CUSTOMER_ACCOUNT_ASSIGN_ROLE: 'customer-account:assign-role',

  // Estate
  ESTATE_CREATE: 'estate:create',
  ESTATE_READ: 'estate:read',
  ESTATE_UPDATE: 'estate:update',
  ESTATE_DELETE: 'estate:delete',
  ESTATE_APPROVE: 'estate:approve',
  ESTATE_REJECT: 'estate:reject',
  ESTATE_FEATURE: 'estate:feature',

  // Media
  MEDIA_UPLOAD: 'media:upload',
  MEDIA_READ: 'media:read',
  MEDIA_UPDATE: 'media:update',
  MEDIA_DELETE: 'media:delete',

  // Lead
  LEAD_CREATE: 'lead:create',
  LEAD_READ: 'lead:read',
  LEAD_UPDATE: 'lead:update',
  LEAD_DELETE: 'lead:delete',

  // Role
  ROLE_CREATE: 'role:create',
  ROLE_READ: 'role:read',
  ROLE_UPDATE: 'role:update',
  ROLE_DELETE: 'role:delete',
  ROLE_ASSIGN_PERMISSION: 'role:assign-permission',

  // Permission
  PERMISSION_CREATE: 'permission:create',
  PERMISSION_READ: 'permission:read',
  PERMISSION_UPDATE: 'permission:update',
  PERMISSION_DELETE: 'permission:delete',

  // Location
  LOCATION_MANAGE: 'location:manage',

  // System
  METRICS_READ: 'metrics:read',
  ADMIN_PORTAL_ACCESS: 'admin-portal:access',
  SYSTEM_CONFIG: 'system:config',
  SYSTEM_AUDIT: 'system:audit',
} as const;

export type PermissionName = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];
