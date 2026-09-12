import { Injectable, Optional } from '@nestjs/common';
import { DataSource } from 'typeorm';

import { BusinessException } from '../../../../common/exceptions/business.exception';
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
  /** Provider membership state used by IA-02 provider authorization. */
  membershipStatus?: 'ACTIVE' | 'SUSPENDED' | 'REMOVED';
  /** Provider membership identifier when the IA-02 schema is available. */
  membershipId?: string;
};

/** Resolves the provider account associated with a customer. */
@Injectable()
export class CurrentProviderContext {
  constructor(
    private readonly providerAccountRepository: ProviderAccountRepository,
    @Optional() private readonly dataSource?: DataSource,
  ) {}

  /**
   * Loads the provider identity and state needed by downstream provider features.
   * A missing account is an explicit domain error; this method never creates it.
   */
  async resolve(customerId: string): Promise<CurrentProviderContextValue> {
    if (this.dataSource) {
      const memberships = await this.dataSource.query<MembershipRow[]>(
        `SELECT membership.id AS membership_id, membership.status AS membership_status,
                provider.id AS provider_id, provider.type AS provider_type,
                provider.status AS provider_status, provider.verification_status
         FROM tbl_provider_membership membership
         INNER JOIN tbl_provider_account provider ON provider.id = membership.provider_id
         WHERE membership.customer_id = $1 AND membership.deleted_at IS NULL
           AND provider.deleted_at IS NULL
         ORDER BY membership.joined_at ASC, membership.id ASC
         LIMIT 1`,
        [customerId],
      );
      const membership = memberships[0];
      if (membership) {
        return {
          customerId,
          providerId: membership.provider_id,
          providerType: membership.provider_type,
          providerStatus: membership.provider_status,
          verificationStatus: membership.verification_status,
          membershipId: membership.membership_id,
          membershipStatus: membership.membership_status,
        };
      }
    }

    // Compatibility fallback for databases before the IA-02 expand migration.
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

type MembershipRow = {
  membership_id: string;
  membership_status: 'ACTIVE' | 'SUSPENDED' | 'REMOVED';
  provider_id: string;
  provider_type: ProviderType;
  provider_status: ProviderStatus;
  verification_status: ProviderVerificationStatus;
};
