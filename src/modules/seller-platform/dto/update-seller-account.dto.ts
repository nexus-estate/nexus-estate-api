import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class UpdateSellerAccountDto {
  @ApiProperty({ example: 'Updated Display Name' })
  @IsOptional()
  @IsString()
  displayName: string;
}
