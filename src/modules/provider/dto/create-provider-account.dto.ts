import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsString, MaxLength } from 'class-validator';

import { ProviderType } from '../enums/account.enums';

/** Request payload for creating the authenticated customer's provider account. */
export class CreateProviderAccountDto {
  /** Account operating model selected during onboarding. */
  @ApiProperty({ enum: ProviderType, example: ProviderType.INDIVIDUAL })
  @IsEnum(ProviderType)
  type: ProviderType;

  /** Human-readable name displayed to marketplace users. */
  @ApiProperty({ example: 'Nguyen Van A' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  displayName: string;
}

/** @deprecated Use CreateProviderAccountDto in new code. */
