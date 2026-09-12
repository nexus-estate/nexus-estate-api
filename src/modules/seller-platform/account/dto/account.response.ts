import { ApiProperty } from '@nestjs/swagger';

import {
  SellerStatus,
  SellerType,
  SellerVerificationStatus,
} from '../enums/account.enums';

export class SellerAccountResponse {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ enum: SellerType })
  type: SellerType;

  @ApiProperty()
  displayName: string;

  @ApiProperty({ enum: SellerStatus, enumName: 'SellerStatus' })
  status: SellerStatus;

  @ApiProperty({
    enum: SellerVerificationStatus,
    enumName: 'SellerVerificationStatus',
  })
  verificationStatus: SellerVerificationStatus;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  updatedAt: Date;
}
