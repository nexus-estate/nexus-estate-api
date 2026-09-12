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
- buyerId
- createdAt
- updatedAt
- deletedAt
- createdBy
- updatedBy

buyerId sau này lấy từ JWT/current user.
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

import { EstatePurpose, EstateType } from '../type/estate.type';

export class CreateEstateDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsEnum(EstateType)
  type: EstateType;

  @IsEnum(EstatePurpose)
  purpose: EstatePurpose;

  @IsNumber()
  @Min(0)
  price: number;

  @IsOptional()
  @IsNumber()
  @IsPositive()
  area?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  bedrooms?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  bathrooms?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  floors?: number;

  @IsString()
  @IsNotEmpty()
  addressLine: string;

  @IsUUID()
  provinceId: string;

  @IsUUID()
  wardId: string;

  @IsOptional()
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude?: number;

  @IsOptional()
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude?: number;
}
