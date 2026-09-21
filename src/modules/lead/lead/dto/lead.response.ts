import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { LeadStatus } from '../entities';

export class LeadResponse {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty({ format: 'uuid' }) listingId: string;
  @ApiProperty({ enum: LeadStatus }) status: LeadStatus;
  @ApiProperty() name: string;
  @ApiProperty() phone: string;
  @ApiPropertyOptional({ nullable: true }) email: string | null;
  @ApiPropertyOptional({ nullable: true }) message: string | null;
  @ApiProperty({ type: String, format: 'date-time' }) createdAt: Date;
}
