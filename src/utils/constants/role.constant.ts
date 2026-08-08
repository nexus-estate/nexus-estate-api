export const ROLES = {
  ADMIN: 'admin',
  BROKER: 'broker',
  BUYER: 'buyer',
} as const;

export type RoleName = (typeof ROLES)[keyof typeof ROLES];
