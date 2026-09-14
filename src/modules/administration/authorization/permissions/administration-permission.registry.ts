import {
  ADMINISTRATION_PERMISSIONS,
  type AdministrationPermissionCode,
} from '../constants/administration-permission.constant';
import {
  AuthorizationPlatform,
  AuthorizationRiskLevel,
} from '../enums/authorization-platform.enum';

const metadata = (
  code: AdministrationPermissionCode,
  name: string,
  category: string,
  riskLevel: AuthorizationRiskLevel,
) => {
  const separator = code.lastIndexOf(':');
  const resource = separator > 0 ? code.slice(0, separator) : code;
  const action = separator > 0 ? code.slice(separator + 1) : 'manage';
  return {
    code,
    name,
    description: name,
    platform: AuthorizationPlatform.ADMINISTRATION,
    category,
    resource,
    action: action ?? 'manage',
    riskLevel,
    isAssignable: true,
  };
};

/** Code-owned administration permission catalogue. */
export const ADMINISTRATION_PERMISSION_REGISTRY = [
  metadata(
    ADMINISTRATION_PERMISSIONS.ADMIN_PORTAL_ACCESS,
    'Access administration portal',
    'Administration',
    AuthorizationRiskLevel.CRITICAL,
  ),
  metadata(
    ADMINISTRATION_PERMISSIONS.PROVIDER_ACCOUNT_READ,
    'Read provider accounts',
    'Provider',
    AuthorizationRiskLevel.LOW,
  ),
  metadata(
    ADMINISTRATION_PERMISSIONS.PROVIDER_ACCOUNT_APPROVE,
    'Approve provider accounts',
    'Provider',
    AuthorizationRiskLevel.HIGH,
  ),
  metadata(
    ADMINISTRATION_PERMISSIONS.PROVIDER_ACCOUNT_SUSPEND,
    'Suspend provider accounts',
    'Provider',
    AuthorizationRiskLevel.HIGH,
  ),
  metadata(
    ADMINISTRATION_PERMISSIONS.PROVIDER_ACCOUNT_REJECT,
    'Reject provider accounts',
    'Provider',
    AuthorizationRiskLevel.HIGH,
  ),
  metadata(
    ADMINISTRATION_PERMISSIONS.METRICS_READ,
    'Read metrics',
    'Metrics',
    AuthorizationRiskLevel.LOW,
  ),
  metadata(
    ADMINISTRATION_PERMISSIONS.AUTHORIZATION_PLATFORM_READ,
    'Read authorization platforms',
    'Authorization',
    AuthorizationRiskLevel.CRITICAL,
  ),
  metadata(
    ADMINISTRATION_PERMISSIONS.AUTHORIZATION_ROLE_READ,
    'Read authorization roles',
    'Authorization',
    AuthorizationRiskLevel.CRITICAL,
  ),
  metadata(
    ADMINISTRATION_PERMISSIONS.AUTHORIZATION_ROLE_WRITE,
    'Manage authorization roles',
    'Authorization',
    AuthorizationRiskLevel.CRITICAL,
  ),
  metadata(
    ADMINISTRATION_PERMISSIONS.AUTHORIZATION_PERMISSION_READ,
    'Read authorization permissions',
    'Authorization',
    AuthorizationRiskLevel.CRITICAL,
  ),
  metadata(
    ADMINISTRATION_PERMISSIONS.AUTHORIZATION_ASSIGNMENT_READ,
    'Read authorization assignments',
    'Authorization',
    AuthorizationRiskLevel.CRITICAL,
  ),
  metadata(
    ADMINISTRATION_PERMISSIONS.AUTHORIZATION_ASSIGNMENT_WRITE,
    'Manage authorization assignments',
    'Authorization',
    AuthorizationRiskLevel.CRITICAL,
  ),
  metadata(
    ADMINISTRATION_PERMISSIONS.AUTHORIZATION_AUDIT_READ,
    'Read authorization audit',
    'Authorization',
    AuthorizationRiskLevel.CRITICAL,
  ),
] as const;
