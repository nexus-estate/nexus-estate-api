import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

import { BaseRepository } from '../../../../services/abstraction-services';
import { SellerVerificationStatus } from '../enums/account.enums';
import { SellerAccount } from '../models/account.entity';

/**
 * Persistence gateway for seller accounts.
 *
 * Generic CRUD operations are intentionally inherited from BaseRepository so
 * new account use cases do not duplicate TypeORM repository plumbing here.
 */
@Injectable()
export class SellerAccountRepository extends BaseRepository<SellerAccount> {
  constructor(dataSource: DataSource) {
    super(dataSource, SellerAccount, 'SellerAccount');
  }

  /** Finds the account owned by a specific buyer, excluding soft-deleted rows. */
  findByOwnerBuyerId(ownerBuyerId: string): Promise<SellerAccount | null> {
    return this.repository.findOne({ where: { ownerBuyerId } });
  }

  /** Checks account ownership without loading the full entity. */
  async existsByOwnerBuyerId(ownerBuyerId: string): Promise<boolean> {
    return this.repository.exists({ where: { ownerBuyerId } });
  }

  /** Lists pending seller accounts with owner data for administrator review. */
  findPendingForReview(): Promise<SellerAccount[]> {
    return this.repository.find({
      where: { verificationStatus: SellerVerificationStatus.PENDING },
      relations: { owner: { role: true } },
      order: { createdAt: 'ASC' },
    });
  }

  /** Finds one pending seller account with owner data for administrator review. */
  findPendingByIdForReview(id: string): Promise<SellerAccount | null> {
    return this.repository.findOne({
      where: {
        id,
        verificationStatus: SellerVerificationStatus.PENDING,
      },
      relations: { owner: { role: true } },
    });
  }
}
