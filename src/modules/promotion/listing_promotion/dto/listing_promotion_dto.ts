import { IsDateString } from 'class-validator';

export class CreateListingPromotionDto {
  @IsDateString()
  startAt: string;
  @IsDateString()
  endAt: string;
}
