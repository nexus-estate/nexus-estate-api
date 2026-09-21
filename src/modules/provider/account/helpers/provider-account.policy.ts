import { Injectable, Logger } from '@nestjs/common';

import { BusinessException } from '../../../../common/exceptions/business.exception';
import type { ProviderContext } from '../services/provider-context.resolver';
import {
  ProviderStatus,
  ProviderVerificationStatus,
} from '../enums/account.enums';
import { ProviderAccountErrorCodes } from '../errors/provider-account-error-codes';

/** Encapsulates provider-state and ownership checks shared by supply features. */
@Injectable()
export class ProviderAccountPolicy {
  private readonly logger = new Logger(ProviderAccountPolicy.name);

  /** Rejects supply operations unless provider status and verification permit mutation. */
  requireActiveProvider(context: ProviderContext): void {
    if (context.membershipStatus && context.membershipStatus !== 'ACTIVE') {
      throw new BusinessException(
        ProviderAccountErrorCodes.PROVIDER_ACCOUNT_FORBIDDEN,
      );
    }
    if (context.providerStatus !== ProviderStatus.ACTIVE) {
      this.logger.warn(
        JSON.stringify({
          operation: 'provider_account.supply_mutation_denied',
          reason: 'suspended',
          customer_id: context.customerId,
          provider_id: context.providerId,
        }),
      );
      throw new BusinessException(
        ProviderAccountErrorCodes.PROVIDER_ACCOUNT_SUSPENDED,
      );
    }

    if (context.verificationStatus !== ProviderVerificationStatus.VERIFIED) {
      this.logger.warn(
        JSON.stringify({
          operation: 'provider_account.supply_mutation_denied',
          reason: 'not_verified',
          customer_id: context.customerId,
          provider_id: context.providerId,
          verification_status: context.verificationStatus,
        }),
      );
      throw new BusinessException(
        ProviderAccountErrorCodes.PROVIDER_ACCOUNT_NOT_VERIFIED,
      );
    }
  }

  /** Rejects access when the resolved provider context does not belong to the customer. */
  requireProviderOwnership(
    context: ProviderContext,
    resourceProviderId: string,
  ): void {
    if (context.providerId !== resourceProviderId) {
      throw new BusinessException(
        ProviderAccountErrorCodes.PROVIDER_ACCOUNT_FORBIDDEN,
      );
    }
  }
}
