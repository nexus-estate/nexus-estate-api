import { ApiProperty } from '@nestjs/swagger';
import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

import { SellerType } from '../../seller-platform/account/enums/account.enums';

/** Required fields for an independent public seller registration. */
export class RegisterSellerDto {
  /** Login email for the seller user. */
  @ApiProperty({ example: 'seller@nexus.test' })
  @IsEmail()
  email: string;

  /** Login password for the seller user. */
  @ApiProperty({ minLength: 8, example: 'correct-password' })
  @IsString()
  @MinLength(8)
  password: string;

  /** Seller operating model required by the SellerAccount persistence contract. */
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
