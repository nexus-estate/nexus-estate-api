import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  Max,
  Min,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { EstatePurpose, EstateType } from '../types/estate.type';

export class CreateEstateDto {
  @ApiProperty({ example: 'Riverside apartment' })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiPropertyOptional({ example: 'River view' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ enum: EstateType, example: EstateType.APARTMENT })
  @IsEnum(EstateType)
  type: EstateType;

  @ApiProperty({ enum: EstatePurpose, example: EstatePurpose.SALE })
  @IsEnum(EstatePurpose)
  purpose: EstatePurpose;

  @ApiProperty({ minimum: 0, example: 3500000000 })
  @IsNumber()
  @Min(0)
  price: number;

  @ApiPropertyOptional({ minimum: 0, exclusiveMinimum: true, example: 82.5 })
  @IsOptional()
  @IsNumber()
  @IsPositive()
  area?: number;

  @ApiPropertyOptional({ minimum: 0, maximum: 100, example: 2 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  bedrooms?: number;

  @ApiPropertyOptional({ minimum: 0, maximum: 100, example: 2 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  bathrooms?: number;

  @ApiPropertyOptional({ minimum: 0, maximum: 100, example: 20 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  floors?: number;

  @ApiProperty({ example: '1 Nguyen Hue' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  addressLine: string;

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  provinceId: string;

  @ApiPropertyOptional({
    format: 'uuid',
    deprecated: true,
    description:
      'Legacy identifier accepting any administrative unit type. Use one typed field instead.',
  })
  @IsOptional()
  @IsUUID()
  wardId?: string;

  @ApiPropertyOptional({
    format: 'uuid',
    nullable: true,
    description: 'Phường; choose exactly one typed unit.',
  })
  @IsOptional()
  @IsUUID()
  urbanWardId?: string | null;

  @ApiPropertyOptional({
    format: 'uuid',
    nullable: true,
    description: 'Xã; choose exactly one typed unit.',
  })
  @IsOptional()
  @IsUUID()
  communeId?: string | null;

  @ApiPropertyOptional({
    format: 'uuid',
    nullable: true,
    description: 'Đặc khu; choose exactly one typed unit.',
  })
  @IsOptional()
  @IsUUID()
  specialZoneId?: string | null;

  @ApiPropertyOptional({ minimum: -90, maximum: 90, example: 10.7769 })
  @IsOptional()
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude?: number;

  @ApiPropertyOptional({ minimum: -180, maximum: 180, example: 106.7009 })
  @IsOptional()
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude?: number;
}
