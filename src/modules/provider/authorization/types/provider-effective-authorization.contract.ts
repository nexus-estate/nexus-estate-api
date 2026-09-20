import {
  ProviderStatus,
  ProviderVerificationStatus,
} from '../../account/enums/account.enums';
import type { ProviderMembershipStatus } from '../../account/services/provider-context.resolver';

/** Role summary granted through a provider membership. */
export interface ProviderAuthorizationRole {
  readonly id: string;
  readonly code: string;
  readonly name: string;
}

/** Effective permission summary granted through a provider membership. */
export interface ProviderAuthorizationPermission {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly category: string;
}

/**
 * Explicit contract for the provider realm's effective authorization.
 * Marketplace authorization must keep its own contract rather than sharing
 * this shape, because the two realms do not share identical business meaning.
 */
export interface ProviderEffectiveAuthorization {
  readonly platform: 'PROVIDER';
  readonly providerId: string | null;
  readonly membershipId: string | null;
  readonly roles: ProviderAuthorizationRole[];
  readonly permissions: ProviderAuthorizationPermission[];
  readonly providerStatus: ProviderStatus | null;
  readonly verificationStatus: ProviderVerificationStatus | null;
  readonly membershipStatus: ProviderMembershipStatus | null;
  readonly providerDisplayName: string | null;
  readonly authorizationVersion: string;
}
