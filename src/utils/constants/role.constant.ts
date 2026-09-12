/** @deprecated Legacy global roles retained for migration compatibility only. */
export const ROLES = {
  ADMINISTRATOR: 'administrator',
  PROVIDER: 'provider',
  CUSTOMER: 'customer',
} as const;

export type RoleName = (typeof ROLES)[keyof typeof ROLES];

/** Represents an unauthenticated API caller, not a database role. */
export const ANONYMOUS_ROLE = 'anonymous' as const;

export type AccessRole = RoleName | typeof ANONYMOUS_ROLE;
