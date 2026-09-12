import { ApiProperty } from '@nestjs/swagger';

import { SellerAccountResponse } from '../../seller-platform/account/dto/account.response';

/** Public result returned after a seller buyer and seller account are created. */
export class SellerRegistrationResponse {
  /** BuyerAccount identifier used for subsequent authentication. */
  @ApiProperty({ format: 'uuid' })
  buyerId: string;

  /** Persisted role assigned to seller API access. */
  @ApiProperty({ example: 'seller' })
  role: string;

  /** Seller account remains unverified until an administrator reviews it. */
  @ApiProperty({ type: () => SellerAccountResponse })
  sellerAccount: SellerAccountResponse;
}
