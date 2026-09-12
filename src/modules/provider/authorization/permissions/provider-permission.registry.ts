/** Code-owned provider catalogue for provider-account capabilities. */
export const PROVIDER_PERMISSION_REGISTRY = [
  {
    code: 'provider-account:read',
    name: 'Read provider account',
    description: 'Read the current provider account profile.',
    platform: 'PROVIDER',
    category: 'Provider Account',
    resource: 'provider-account',
    action: 'read',
    riskLevel: 'LOW',
    isAssignable: true,
  },
  {
    code: 'provider-account:update',
    name: 'Update provider account',
    description: 'Update provider account profile fields.',
    platform: 'PROVIDER',
    category: 'Provider Account',
    resource: 'provider-account',
    action: 'update',
    riskLevel: 'MEDIUM',
    isAssignable: true,
  },
] as const;
