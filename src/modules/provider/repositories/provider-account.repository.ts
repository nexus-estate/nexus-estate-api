import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

import { BaseRepository } from '../../../services/abstraction-services';
import { ProviderVerificationStatus } from '../enums/account.enums';
import { ProviderAccount } from '../models/provider-account.entity';

/**
 * Persistence gateway for provider accounts.
 *
 * Generic CRUD operations are intentionally inherited from BaseRepository so
 * new account use cases do not duplicate TypeORM repository plumbing here.
 */
@Injectable()
export class ProviderAccountRepository extends BaseRepository<ProviderAccount> {
  constructor(dataSource: DataSource) {
    super(dataSource, ProviderAccount, 'ProviderAccount');
  }

  /** Finds the account owned by a specific customer, excluding soft-deleted rows. */
  findByOwnerCustomerId(
    ownerCustomerId: string,
  ): Promise<ProviderAccount | null> {
    return this.repository.findOne({ where: { ownerCustomerId } });
  }

  /** Checks account ownership without loading the full entity. */
  async existsByOwnerCustomerId(ownerCustomerId: string): Promise<boolean> {
    return this.repository.exists({ where: { ownerCustomerId } });
  }

  /** Lists pending provider accounts with owner data for administrator review. */
  findPendingForReview(): Promise<ProviderAccount[]> {
    return this.repository.find({
      where: { verificationStatus: ProviderVerificationStatus.PENDING },
      relations: { owner: { role: true } },
      order: { createdAt: 'ASC' },
    });
  }

  /** Finds one pending provider account with owner data for administrator review. */
  findPendingByIdForReview(id: string): Promise<ProviderAccount | null> {
    return this.repository.findOne({
      where: {
        id,
        verificationStatus: ProviderVerificationStatus.PENDING,
      },
      relations: { owner: { role: true } },
    });
  }
}
