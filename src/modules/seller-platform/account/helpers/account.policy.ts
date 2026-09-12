import { Injectable, Logger } from '@nestjs/common';

import { BusinessException } from '../../../../common/exceptions/business.exception';
import { CurrentSellerContextValue } from '../services/current-seller-context.service';
import { SellerStatus } from '../enums/account.enums';
import { SellerAccountErrorCodes } from './errors';

@Injectable()
export class SellerAccountPolicy {
  private readonly logger = new Logger(SellerAccountPolicy.name);

  requireActiveSeller(context: CurrentSellerContextValue): void {
    if (context.sellerStatus === SellerStatus.SUSPENDED) {
      this.logger.warn(
        JSON.stringify({
          operation: 'seller_account.supply_mutation_denied',
          user_id: context.userId,
          seller_id: context.sellerId,
        }),
      );
      throw new BusinessException(
        SellerAccountErrorCodes.SELLER_ACCOUNT_SUSPENDED,
      );
    }
  }

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
