import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsString, MaxLength } from 'class-validator';

import { SellerType } from '../enums';

export class CreateSellerAccountDto {
  @ApiProperty({ enum: SellerType, example: SellerType.INDIVIDUAL })
  @IsEnum(SellerType)
  type: SellerType;

  @ApiProperty({ example: 'Nguyen Van A' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  displayName: string;
}
