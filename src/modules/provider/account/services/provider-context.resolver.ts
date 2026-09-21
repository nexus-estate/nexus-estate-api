import { Injectable, Optional } from '@nestjs/common';
import { DataSource, QueryFailedError } from 'typeorm';

import { BusinessException } from '../../../../common/exceptions/business.exception';
import { ProviderAccountErrorCodes } from '../errors/provider-account-error-codes';
import { ProviderAccountRepository } from '../repositories/provider-account.repository';
import {
  ProviderStatus,
  ProviderType,
  ProviderVerificationStatus,
} from '../enums/account.enums';

/** Provider membership lifecycle state used by provider authorization. */
export type ProviderMembershipStatus = 'ACTIVE' | 'SUSPENDED' | 'REMOVED';

/**
 * Resolved provider context shared by provider profile, authorization, and
 * supply features.
 *
 * `membershipId` and `membershipStatus` are null only on the legacy fallback
 * path, which is used when the IA-02 provider membership schema is genuinely
 * unavailable. On a migrated database both fields are always present.
 */
export interface ProviderContext {
  /** Authenticated customer identifier. */
  readonly customerId: string;
  /** Provider-account identifier. */
  readonly providerId: string;
  /** Provider operating model. */
  readonly providerType: ProviderType;
  /** Provider lifecycle state. */
  readonly providerStatus: ProviderStatus;
  /** Provider verification state. */
  readonly verificationStatus: ProviderVerificationStatus;
  /** Provider display name used by provider-facing authorization responses. */
  readonly providerDisplayName: string;
  /** Provider membership identifier, or null on the legacy fallback path. */
  readonly membershipId: string | null;
  /** Provider membership state, or null on the legacy fallback path. */
  readonly membershipStatus: ProviderMembershipStatus | null;
}

/**
 * Single source of truth for provider context selection.
 *
 * Callers may provide `providerId`; otherwise this resolver accepts exactly one
 * active membership and rejects ambiguity. It validates membership server-side
 * and only uses the legacy owner-account fallback when the membership schema is
 * genuinely unavailable, never when it returns zero active memberships.
 */
@Injectable()
export class ProviderContextResolver {
  constructor(
    private readonly providerAccountRepository: ProviderAccountRepository,
    @Optional() private readonly dataSource?: DataSource,
  ) {}

  /**
   * Selects and validates the exact provider context for a customer request.
   * A missing account is an explicit domain error; this method never creates it.
   */
  async resolve(
    customerId: string,
    providerId?: string,
  ): Promise<ProviderContext> {
    if (this.dataSource) {
      if (providerId && !UUID_PATTERN.test(providerId)) {
        throw new BusinessException(
          ProviderAccountErrorCodes.PROVIDER_ACCOUNT_FORBIDDEN,
        );
      }
      const parameters: string[] = [customerId];
      const providerFilter = providerId
        ? (() => {
            parameters.push(providerId);
            return 'AND provider.id = $2';
          })()
        : '';
      // Only a missing expand-migration table may use the legacy account
      // fallback. An empty result from an available membership schema is a
      // real authorization decision and must not pick an arbitrary account.
      let memberships: MembershipRow[] = [];
      let membershipSchemaAvailable = true;
      try {
        memberships = await this.dataSource.query<MembershipRow[]>(
          `SELECT membership.id AS membership_id, membership.status AS membership_status,
                  provider.id AS provider_id, provider.type AS provider_type,
                  provider.status AS provider_status, provider.verification_status,
                  provider.display_name
           FROM tbl_provider_membership membership
           INNER JOIN tbl_provider_account provider ON provider.id = membership.provider_id
           WHERE membership.customer_id = $1 AND membership.deleted_at IS NULL
             AND provider.deleted_at IS NULL
             AND membership.status = 'ACTIVE'
             ${providerFilter}
           ORDER BY membership.joined_at ASC, membership.id ASC`,
          parameters,
        );
      } catch (error) {
        const driverError: unknown =
          error instanceof QueryFailedError && error.driverError !== undefined
            ? (error.driverError as unknown)
            : null;
        if (
          typeof driverError !== 'object' ||
          driverError === null ||
          !('code' in driverError) ||
          driverError.code !== '42P01'
        ) {
          throw error;
        }
        membershipSchemaAvailable = false;
      }
      if (membershipSchemaAvailable && memberships.length === 0) {
        throw new BusinessException(
          providerId
            ? ProviderAccountErrorCodes.PROVIDER_ACCOUNT_FORBIDDEN
            : ProviderAccountErrorCodes.PROVIDER_ACCOUNT_NOT_FOUND,
        );
      }
      if (providerId && memberships.length === 0) {
        throw new BusinessException(
          ProviderAccountErrorCodes.PROVIDER_ACCOUNT_FORBIDDEN,
        );
      }
      if (!providerId && memberships.length > 1) {
        throw new BusinessException(
          ProviderAccountErrorCodes.PROVIDER_CONTEXT_REQUIRED,
        );
      }
      const membership = memberships[0];
      if (membership) {
        return {
          customerId,
          providerId: membership.provider_id,
          providerType: membership.provider_type,
          providerStatus: membership.provider_status,
          verificationStatus: membership.verification_status,
          providerDisplayName: membership.display_name,
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
    if (providerId && providerId !== account.id) {
      throw new BusinessException(
        ProviderAccountErrorCodes.PROVIDER_ACCOUNT_FORBIDDEN,
      );
    }

    return {
      customerId,
      providerId: account.id,
      providerType: account.type,
      providerStatus: account.status,
      verificationStatus: account.verificationStatus,
      providerDisplayName: account.displayName,
      membershipId: null,
      membershipStatus: null,
    };
  }
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type MembershipRow = {
  membership_id: string;
  membership_status: ProviderMembershipStatus;
  provider_id: string;
  provider_type: ProviderType;
  provider_status: ProviderStatus;
  verification_status: ProviderVerificationStatus;
  display_name: string;
};
