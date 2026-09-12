import { ApiProperty } from '@nestjs/swagger';
import {
  IsEnum,
  IsNotEmpty,
  IsUUID,
  IsString,
  MaxLength,
} from 'class-validator';

import { SellerType } from '../../seller-platform/account/enums/account.enums';

/** Authenticated buyer payload for submitting a seller-registration request. */
export class RegisterSellerFromBuyerDto {
  /** Existing buyer user identifier submitting the request. */
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
