import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { Estate } from '../entities';
import { EstatePurpose, EstateType } from '../types/estate.type';

export class EstateLocationResponse {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty() code: string;
  @ApiProperty() name: string;
}

/**
 * Wire contract for Estate endpoints.
 *
 * Provider is the canonical owner; the legacy customer ownership column is
 * provenance-only and must never appear in a public or provider response.
 */
export class EstateResponse {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty({ format: 'uuid' }) providerId: string;
  @ApiProperty() title: string;
  @ApiPropertyOptional({ nullable: true }) description: string | null;
  @ApiProperty({ enum: EstateType }) type: EstateType;
  @ApiProperty({ enum: EstatePurpose }) purpose: EstatePurpose;
  @ApiProperty() price: number;
  @ApiPropertyOptional({ nullable: true }) area: number | null;
  @ApiPropertyOptional({ nullable: true }) bedrooms: number | null;
  @ApiPropertyOptional({ nullable: true }) bathrooms: number | null;
  @ApiPropertyOptional({ nullable: true }) floors: number | null;
  @ApiProperty() addressLine: string;
  @ApiProperty({ format: 'uuid' }) provinceId: string;
  @ApiProperty({ format: 'uuid' }) wardId: string;
  @ApiPropertyOptional({ nullable: true }) latitude: number | null;
  @ApiPropertyOptional({ nullable: true }) longitude: number | null;
  @ApiProperty({ type: () => EstateLocationResponse, nullable: false })
  province: EstateLocationResponse;
  @ApiProperty({ type: () => EstateLocationResponse, nullable: false })
  ward: EstateLocationResponse;
  @ApiProperty({ type: String, format: 'date-time' }) createdAt: Date;
  @ApiProperty({ type: String, format: 'date-time' }) updatedAt: Date;

  /** Maps a persisted estate to the explicit response contract. */
  static toResponse(estate: Estate): EstateResponse {
    return {
      id: estate.id,
      providerId: estate.providerId,
      title: estate.title,
      description: estate.description,
      type: estate.type,
      purpose: estate.purpose,
      price: Number(estate.price),
      area: estate.area === null ? null : Number(estate.area),
      bedrooms: estate.bedrooms,
      bathrooms: estate.bathrooms,
      floors: estate.floors,
      addressLine: estate.addressLine,
      provinceId: estate.provinceId,
      wardId: estate.wardId,
      latitude: estate.latitude === null ? null : Number(estate.latitude),
      longitude: estate.longitude === null ? null : Number(estate.longitude),
      // Province/Ward are NOT NULL schema relations and every response passes
      // through the repository hydration path, so they are always present.
      province: {
        id: estate.province.id,
        code: estate.province.code,
        name: estate.province.name,
      },
      ward: {
        id: estate.ward.id,
        code: estate.ward.code,
        name: estate.ward.name,
      },
      createdAt: estate.createdAt,
      updatedAt: estate.updatedAt,
    };
  }
}
