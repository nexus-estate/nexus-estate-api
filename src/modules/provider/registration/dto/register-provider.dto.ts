import { ApiProperty } from '@nestjs/swagger';
import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

import { ProviderType } from '../../account/enums/account.enums';

/** Required fields for an independent public provider registration. */
export class RegisterProviderDto {
  /** Login email for the provider account. */
  @ApiProperty({ example: 'provider@nexus.test' })
  @IsEmail()
  email: string;

  /** Login password for the provider account. */
  @ApiProperty({ minLength: 8, example: 'correct-password' })
  @IsString()
  @MinLength(8)
  password: string;

  /** Provider operating model required by the ProviderAccount persistence contract. */
  @ApiProperty({ enum: ProviderType, example: ProviderType.INDIVIDUAL })
  @IsEnum(ProviderType)
  type: ProviderType;

  /** Marketplace-facing provider name. */
  @ApiProperty({ example: 'Nexus Realty' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  displayName: string;
}
