import {
  IsString,
  IsNumber,
  IsEnum,
  IsOptional,
  IsBoolean,
  IsDateString,
  IsUUID,
  MaxLength,
  Min,
  IsObject,
} from 'class-validator';
import { Type } from 'class-transformer';
import { PropertyType, PropertyPurpose } from '../entities/estate.entity';
import type { PropertyFeatures } from '../entities/estate.entity';

export class CreateEstateDto {
  @IsString()
  @MaxLength(500)
  title: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  price?: number;

  @IsEnum(PropertyType)
  type: PropertyType;

  @IsEnum(PropertyPurpose)
  purpose: PropertyPurpose;

  @IsString()
  @MaxLength(500)
  address: string;

  @IsOptional()
  @IsUUID()
  provinceId?: string;

  @IsOptional()
  @IsUUID()
  wardId?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  area?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  bedrooms?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  bathrooms?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  floors?: number;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  latitude?: number;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  longitude?: number;

  @IsOptional()
  @IsObject()
  features?: PropertyFeatures;

  @IsOptional()
  @IsDateString()
  startDate?: Date;

  @IsOptional()
  @IsDateString()
  endDate?: Date;

  @IsOptional()
  @IsBoolean()
  isFeatured?: boolean;
}
