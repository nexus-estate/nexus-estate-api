import { Injectable } from '@nestjs/common';

import { BusinessException } from '../../../common/exceptions/business.exception';
import { ProviderAccountErrorCodes } from '../errors/provider-account-error-codes';
import { ProviderAccountRepository } from '../repositories/provider-account.repository';
import {
  ProviderStatus,
  ProviderType,
  ProviderVerificationStatus,
} from '../enums/account.enums';

/**
 * Snapshot of the provider state needed by authorization and supply use cases.
 */
export type CurrentProviderContextValue = {
  /** Authenticated customer identifier. */
  customerId: string;
  /** Provider-account identifier. */
  providerId: string;
  /** Provider operating model. */
  providerType: ProviderType;
  /** Provider lifecycle state. */
  providerStatus: ProviderStatus;
  /** Provider verification state. */
  verificationStatus: ProviderVerificationStatus;
};

/** Resolves the provider account associated with a customer. */
@Injectable()
export class CurrentProviderContext {
  constructor(
    private readonly providerAccountRepository: ProviderAccountRepository,
  ) {}

  /**
   * Loads the provider identity and state needed by downstream provider features.
   * A missing account is an explicit domain error; this method never creates it.
   */
  async resolve(customerId: string): Promise<CurrentProviderContextValue> {
    const account =
      await this.providerAccountRepository.findByOwnerCustomerId(customerId);

    if (!account) {
      throw new BusinessException(
        ProviderAccountErrorCodes.PROVIDER_ACCOUNT_NOT_FOUND,
      );
    }

    return {
      customerId,
      providerId: account.id,
      providerType: account.type,
      providerStatus: account.status,
      verificationStatus: account.verificationStatus,
    };
  }
}
