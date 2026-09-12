import { ApiProperty } from '@nestjs/swagger';

import {
  SellerStatus,
  SellerType,
  SellerVerificationStatus,
} from '../enums/account.enums';

/** Public representation of a seller account returned by the API. */
export class SellerAccountResponse {
  /** Stable seller-account identifier. */
  @ApiProperty({ format: 'uuid' })
  id: string;

  /** Account operating model. */
  @ApiProperty({ enum: SellerType })
  type: SellerType;

  /** Marketplace-facing display name. */
  @ApiProperty()
  displayName: string;

  /** Current lifecycle state. */
  @ApiProperty({ enum: SellerStatus, enumName: 'SellerStatus' })
  status: SellerStatus;

  /** Current verification state. */
  @ApiProperty({
    enum: SellerVerificationStatus,
    enumName: 'SellerVerificationStatus',
  })
  verificationStatus: SellerVerificationStatus;

  /** Creation timestamp inherited from BaseEntity. */
  @ApiProperty({ type: String, format: 'date-time' })
  createdAt: Date;

  /** Last update timestamp inherited from BaseEntity. */
  @ApiProperty({ type: String, format: 'date-time' })
  updatedAt: Date;
}
