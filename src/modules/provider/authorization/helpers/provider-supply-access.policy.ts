import { Injectable } from '@nestjs/common';

import { ProviderAccountPolicy } from '../../account/helpers/provider-account.policy';
import type { ProviderContext } from '../../account/services/provider-context.resolver';
import type { ProviderPermissionCode } from '../permissions/provider-permission.registry';
import { ProviderAuthorizationService } from '../services/provider-authorization.service';

/**
 * Owns the business question "can this provider access provider supply?".
 *
 * Supply features (Estate, Listing) depend on this policy instead of knowing
 * that supply access is granted by the resolved Provider permission catalogue.
 * Lifecycle checks remain separate from permission checks.
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
   * Rejects access unless the provider is active and verified and holds the
   * specified permission.
   */
  async requirePermission(
    context: ProviderContext,
    permissionCode: ProviderPermissionCode,
  ): Promise<void> {
    this.requireReadAccess(context);
    await this.providerAuthorizationService.requirePermission(
      context,
      permissionCode,
    );
  }
}
