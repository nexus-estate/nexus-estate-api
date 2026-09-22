import { ApiProperty } from '@nestjs/swagger';

export class ListingEligiblePropertyResponse {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty()
  title: string;
}
