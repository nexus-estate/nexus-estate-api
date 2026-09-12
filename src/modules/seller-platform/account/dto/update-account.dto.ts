import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

/** Editable seller-account profile fields. */
export class UpdateSellerAccountDto {
  /** New display name; whitespace is normalized by the application service. */
  @ApiPropertyOptional({ example: 'Updated Display Name' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  displayName?: string;
}
