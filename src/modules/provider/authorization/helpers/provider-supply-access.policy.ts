import { Injectable } from '@nestjs/common';

import { ProviderAccountPolicy } from '../../account/helpers/provider-account.policy';
import type { ProviderContext } from '../../account/services/provider-context.resolver';
import { ProviderAuthorizationService } from '../services/provider-authorization.service';

/**
 * Owns the business question "can this provider mutate supply?".
 *
 * Supply features (Estate, Listing) depend on this policy instead of knowing
 * that write access currently means "active, verified provider with the legacy
 * OWNER role". The OWNER rule can be replaced here without touching callers.
 */
@Injectable()
export class ProviderSupplyAccessPolicy {
  constructor(
    private readonly providerAccountPolicy: ProviderAccountPolicy,
    private readonly providerAuthorizationService: ProviderAuthorizationService,
  ) {}

  /** Rejects supply reads unless the provider is active and verified. */
  requireReadAccess(context: ProviderContext): void {
    this.providerAccountPolicy.requireActiveProvider(context);
  }

  /**
   * Rejects supply mutations unless the provider is active, verified, and holds
   * the legacy OWNER role for the selected membership.
   */
  async requireWriteAccess(context: ProviderContext): Promise<void> {
    this.requireReadAccess(context);
    await this.providerAuthorizationService.requireOwner(context);
  }
}
