import { Injectable } from '@nestjs/common';

import { SellerAccountService } from '../../seller-platform/account/services/account.service';
import type { SellerAccountResponse } from '../../seller-platform/account/dto/account.response';

/** Application service for the authenticated seller profile endpoint. */
@Injectable()
export class SellerProfileService {
  constructor(private readonly sellerAccountService: SellerAccountService) {}

  /** Returns the seller account owned by the authenticated seller. */
  getCurrent(userId: string): Promise<SellerAccountResponse> {
    return this.sellerAccountService.getCurrent(userId);
  }
}
