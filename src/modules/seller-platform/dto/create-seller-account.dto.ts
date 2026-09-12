import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

import { SellerType } from '../models/seller-account.enums';

export class CreateSellerAccountDto {
  @ApiProperty({ enum: SellerType, example: SellerType.INDIVIDUAL })
  @IsOptional()
  @IsString()
  type: SellerType;

  @ApiProperty({ example: 'Nguyen Van A' })
  @IsOptional()
  @IsString()
  displayName: string;
}
