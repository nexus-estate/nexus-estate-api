import { Injectable, Logger } from '@nestjs/common';

import { BusinessException } from '../../../../common/exceptions/business.exception';
import { CurrentSellerContextValue } from '../services/current-seller-context.service';
import { SellerStatus } from '../enums/account.enums';
import { SellerAccountErrorCodes } from '../errors/seller-account-error-codes';

/** Encapsulates seller-state and ownership checks shared by supply features. */
@Injectable()
export class SellerAccountPolicy {
  private readonly logger = new Logger(SellerAccountPolicy.name);

  /** Throws when a seller is suspended and cannot mutate supply data. */
  requireActiveSeller(context: CurrentSellerContextValue): void {
    if (context.sellerStatus === SellerStatus.SUSPENDED) {
      this.logger.warn(
        JSON.stringify({
          operation: 'seller_account.supply_mutation_denied',
          buyer_id: context.buyerId,
          seller_id: context.sellerId,
        }),
      );
      throw new BusinessException(
        SellerAccountErrorCodes.SELLER_ACCOUNT_SUSPENDED,
      );
    }
  }

  /** Throws when a seller attempts to mutate another seller's resource. */
  requireSellerOwnership(
    context: CurrentSellerContextValue,
    resourceSellerId: string,
  ): void {
    if (context.sellerId !== resourceSellerId) {
      throw new BusinessException(
        SellerAccountErrorCodes.SELLER_ACCOUNT_FORBIDDEN,
      );
    }
  }
}
