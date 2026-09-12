import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

/** Editable provider-account profile fields. */
export class UpdateProviderAccountDto {
  /** New display name; whitespace is normalized by the application service. */
  @ApiPropertyOptional({ example: 'Updated Display Name' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  displayName?: string;
}

/** @deprecated Use UpdateProviderAccountDto in new code. */
