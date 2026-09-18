/*
PHASE: CreateEstateDto

Target fields client được phép gửi:

title
- string
- required

description
- string
- optional

type
- EstateType enum
- required

purpose
- EstatePurpose enum
- required

price
- number
- required
- >= 0

area
- number
- optional
- > 0

bedrooms
- integer
- optional
- >= 0

bathrooms
- integer
- optional
- >= 0

floors
- integer
- optional
- >= 0

addressLine
- string
- required

provinceId
- UUID
- required

wardId
- UUID
- required

latitude
- number
- optional
- min -90
- max 90

longitude
- number
- optional
- min -180
- max 180

KHÔNG được có:
- id
- customerId
- createdAt
- updatedAt
- deletedAt
- createdBy
- updatedBy

customerId được lấy từ JWT/current user.
*/

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
  addressLine: string;

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  provinceId: string;

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  wardId: string;

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
