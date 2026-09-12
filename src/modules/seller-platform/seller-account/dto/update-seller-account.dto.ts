import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateSellerAccountDto {
  @ApiPropertyOptional({ example: 'Updated Display Name' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  displayName?: string;
}
