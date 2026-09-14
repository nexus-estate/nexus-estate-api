/** Roles owned by the internal administration platform. */
export const ADMINISTRATION_ROLES = {
  SUPER_ADMIN: 'SUPER_ADMIN',
  PROVIDER_REVIEWER: 'PROVIDER_REVIEWER',
} as const;

export type AdministrationRoleCode =
  (typeof ADMINISTRATION_ROLES)[keyof typeof ADMINISTRATION_ROLES];
