import { Injectable } from '@nestjs/common';

import { BusinessException } from '../../../../common/exceptions/business.exception';
import { SellerAccountErrorCodes } from '../helpers/errors';
import { SellerAccountRepository } from '../repositories/account.repository';
import {
  SellerStatus,
  SellerType,
  SellerVerificationStatus,
} from '../enums/account.enums';

/**
 * Snapshot of the seller state needed by authorization and supply use cases.
 */
export type CurrentSellerContextValue = {
  /** Authenticated user identifier. */
  userId: string;
  /** Seller-account identifier. */
  sellerId: string;
  /** Seller operating model. */
  sellerType: SellerType;
  /** Seller lifecycle state. */
  sellerStatus: SellerStatus;
  /** Seller verification state. */
  verificationStatus: SellerVerificationStatus;
};

/** Resolves the seller account associated with an authenticated user. */
@Injectable()
export class CurrentSellerContext {
  constructor(
    private readonly sellerAccountRepository: SellerAccountRepository,
  ) {}

  /**
   * Loads the seller identity and state needed by downstream seller features.
   * A missing account is an explicit domain error; this method never creates it.
   */
  async resolve(userId: string): Promise<CurrentSellerContextValue> {
    const account =
      await this.sellerAccountRepository.findByOwnerUserId(userId);

    if (!account) {
      throw new BusinessException(
        SellerAccountErrorCodes.SELLER_ACCOUNT_NOT_FOUND,
      );
    }

    return {
      userId,
      sellerId: account.id,
      sellerType: account.type,
      sellerStatus: account.status,
      verificationStatus: account.verificationStatus,
    };
  }
}
