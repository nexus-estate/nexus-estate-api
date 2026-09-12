import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsString, MaxLength } from 'class-validator';

import { SellerType } from '../enums/account.enums';

/** Request payload for creating the authenticated user's seller account. */
export class CreateSellerAccountDto {
  /** Account operating model selected during onboarding. */
  @ApiProperty({ enum: SellerType, example: SellerType.INDIVIDUAL })
  @IsEnum(SellerType)
  type: SellerType;

  /** Human-readable name displayed to marketplace users. */
  @ApiProperty({ example: 'Nguyen Van A' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  displayName: string;
}
