import { ApiProperty } from '@nestjs/swagger';

import { SellerAccountResponse } from '../../seller-platform/account/dto/account.response';

/** Minimal buyer information an administrator needs to review a request. */
export class SellerRegistrationOwnerResponse {
  /** Buyer account identifier. */
  @ApiProperty({ format: 'uuid' })
  id: string;

  /** Buyer login email. */
  @ApiProperty({ format: 'email' })
  email: string;

  /** Whether the buyer has verified their email address. */
  @ApiProperty()
  isEmailVerified: boolean;

  /** Current persisted role before approval. */
  @ApiProperty({ example: 'buyer' })
  role: string;

  /** Last successful login, if the buyer has logged in before. */
  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  lastLogin: Date | null;

  /** Buyer account creation timestamp. */
  @ApiProperty({ type: String, format: 'date-time' })
  createdAt: Date;

  /** Buyer account last update timestamp. */
  @ApiProperty({ type: String, format: 'date-time' })
  updatedAt: Date;
}

/** Administrator review view for a pending seller-registration request. */
export class SellerRegistrationReviewResponse {
  /** Seller-account request identifier. */
  @ApiProperty({ format: 'uuid' })
  id: string;

  /** Buyer who submitted or owns the request. */
  @ApiProperty({ type: () => SellerRegistrationOwnerResponse })
  owner: SellerRegistrationOwnerResponse;

  /** Seller-account data submitted for review. */
  @ApiProperty({ type: () => SellerAccountResponse })
  sellerAccount: SellerAccountResponse;
}
