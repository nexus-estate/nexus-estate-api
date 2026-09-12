import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

import { BaseRepository } from '../../../../services/abstraction-services';
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

  /** Finds the account owned by a specific user, excluding soft-deleted rows. */
  findByOwnerUserId(ownerUserId: string): Promise<SellerAccount | null> {
    return this.repository.findOne({ where: { ownerUserId } });
  }

  /** Checks account ownership without loading the full entity. */
  async existsByOwnerUserId(ownerUserId: string): Promise<boolean> {
    return this.repository.exists({ where: { ownerUserId } });
  }
}
