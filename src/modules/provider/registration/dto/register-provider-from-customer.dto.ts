import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsString, MaxLength } from 'class-validator';

import { ProviderType } from '../../account/enums/account.enums';

/** Authenticated customer payload for submitting a provider-registration request. */
export class RegisterProviderFromCustomerDto {
  /** Provider operating model required for the new provider account. */
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
