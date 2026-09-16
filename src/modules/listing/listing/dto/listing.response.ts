import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ListingStatus } from '../entities';
import {
  EstatePurpose,
  EstateType,
} from '../../../estate/property/types/estate.type';

export class ListingEstateResponse {
  @ApiProperty({ format: 'uuid' }) id: string;
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
  @ApiProperty() province: { id: string; code: string; name: string };
  @ApiProperty() ward: { id: string; code: string; name: string };
}

export class ListingResponse {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty({ format: 'uuid' }) estateId: string;
  @ApiProperty({ format: 'uuid' }) providerId: string;
  @ApiProperty({ enum: ListingStatus }) status: ListingStatus;
  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true })
  publishedAt: Date | null;
  @ApiProperty({ type: () => ListingEstateResponse })
  estate: ListingEstateResponse;
  @ApiProperty({ type: String, format: 'date-time' }) createdAt: Date;
  @ApiProperty({ type: String, format: 'date-time' }) updatedAt: Date;
}

export class ListingPageResponse {
  @ApiProperty({ type: [ListingResponse] }) items: ListingResponse[];
  @ApiProperty()
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
}
