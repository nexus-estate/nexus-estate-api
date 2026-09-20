/** Role summary granted through a marketplace customer role assignment. */
export interface MarketplaceAuthorizationRole {
  readonly id: string;
  readonly code: string;
  readonly name: string;
}

/** Effective permission summary granted through a marketplace role. */
export interface MarketplaceAuthorizationPermission {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly category: string;
}

/**
 * Explicit contract for the marketplace realm's effective authorization.
 * It stays distinct from provider authorization because the two realms do not
 * share identical business meaning.
 */
export interface MarketplaceEffectiveAuthorization {
  readonly platform: 'MARKETPLACE';
  readonly roles: MarketplaceAuthorizationRole[];
  readonly permissions: MarketplaceAuthorizationPermission[];
  readonly authorizationVersion: string;
}
