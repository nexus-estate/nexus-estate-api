/** Platforms exposed by the administration authorization-management API. */
export enum AuthorizationPlatform {
  MARKETPLACE = 'MARKETPLACE',
  PROVIDER = 'PROVIDER',
  ADMINISTRATION = 'ADMINISTRATION',
}

export enum AuthorizationRoleStatus {
  ACTIVE = 'ACTIVE',
  DISABLED = 'DISABLED',
}

export enum AuthorizationRiskLevel {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
}
