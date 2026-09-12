import { ApiProperty } from '@nestjs/swagger';
import {
  IsEnum,
  IsNotEmpty,
  IsUUID,
  IsString,
  MaxLength,
} from 'class-validator';

import { SellerType } from '../../seller-platform/account/enums/account.enums';

/** Administrator payload for promoting an existing buyer to seller. */
export class CreateSellerFromBuyerDto {
  /** Existing buyer user identifier to promote. */
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  buyerId: string;

  /** Seller operating model required for the new seller account. */
  @ApiProperty({ enum: SellerType, example: SellerType.INDIVIDUAL })
  @IsEnum(SellerType)
  type: SellerType;

  /** Marketplace-facing seller name. */
  @ApiProperty({ example: 'Nexus Realty' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  displayName: string;
}
