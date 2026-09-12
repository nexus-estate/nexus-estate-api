/**
 * Persisted RBAC roles. Anonymous access is intentionally not persisted;
 * public endpoints use the @Public decorator instead.
 */
export const ROLES = {
  ADMINISTRATOR: 'administrator',
  SELLER: 'seller',
  BUYER: 'buyer',
} as const;

export type RoleName = (typeof ROLES)[keyof typeof ROLES];

/** Represents an unauthenticated API caller, not a database role. */
export const ANONYMOUS_ROLE = 'anonymous' as const;

export type AccessRole = RoleName | typeof ANONYMOUS_ROLE;
