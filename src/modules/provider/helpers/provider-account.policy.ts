import { Injectable, Logger } from '@nestjs/common';

import { BusinessException } from '../../../common/exceptions/business.exception';
import { CurrentProviderContextValue } from '../services/current-provider-context.service';
import { ProviderStatus } from '../enums/account.enums';
import { ProviderAccountErrorCodes } from '../errors/provider-account-error-codes';

/** Encapsulates provider-state and ownership checks shared by supply features. */
@Injectable()
export class ProviderAccountPolicy {
  private readonly logger = new Logger(ProviderAccountPolicy.name);

  /** Throws when a provider is suspended and cannot mutate supply data. */
  requireActiveProvider(context: CurrentProviderContextValue): void {
    if (context.providerStatus === ProviderStatus.SUSPENDED) {
      this.logger.warn(
        JSON.stringify({
          operation: 'provider_account.supply_mutation_denied',
          customer_id: context.customerId,
          provider_id: context.providerId,
        }),
      );
      throw new BusinessException(
        ProviderAccountErrorCodes.PROVIDER_ACCOUNT_SUSPENDED,
      );
    }
  }

  /** Throws when a provider attempts to mutate another provider's resource. */
  requireProviderOwnership(
    context: CurrentProviderContextValue,
    resourceProviderId: string,
  ): void {
    if (context.providerId !== resourceProviderId) {
      throw new BusinessException(
        ProviderAccountErrorCodes.PROVIDER_ACCOUNT_FORBIDDEN,
      );
    }
  }
}
