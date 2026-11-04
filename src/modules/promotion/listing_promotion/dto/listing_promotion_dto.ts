import { ApiProperty } from '@nestjs/swagger';
import { IsInt, Max, Min } from 'class-validator';

export class CreateListingPromotionDto {
  @ApiProperty({
    description: 'Duration in 24-hour days, starting at server time',
    minimum: 1,
    maximum: 365,
    example: 7,
  })
  @IsInt()
  @Min(1)
  @Max(365)
  durationDays: number;
}
