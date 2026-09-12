import { Injectable } from '@nestjs/common';

import { BusinessException } from '../../../common/exceptions/business.exception';
import { SellerAccountErrorCodes } from '../helpers/seller-account.errors';
import { SellerAccountRepository } from '../repositories/seller-account.repository';
import {
  SellerStatus,
  SellerType,
  SellerVerificationStatus,
} from '../models/seller-account.enums';

export type CurrentSellerContextValue = {
  userId: string;
  sellerId: string;
  sellerType: SellerType;
  sellerStatus: SellerStatus;
  verificationStatus: SellerVerificationStatus;
};

@Injectable()
export class CurrentSellerContext {
  constructor(
    private readonly sellerAccountRepository: SellerAccountRepository,
  ) {}

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
