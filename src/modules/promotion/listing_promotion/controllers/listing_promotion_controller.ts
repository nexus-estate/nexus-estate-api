import { Body, Controller, Param, Post } from '@nestjs/common';
import { ListingPromotionService } from '../services/listingPromotion.service';
import { CreateListingPromotionDto } from '../dto/listing_promotion_dto';

@Controller('listings/:listingId/promotions')
export class ListingPromotionController {
  constructor(
    private readonly listingPromotionService: ListingPromotionService,
  ) {}

  @Post('baner')
  async createBanner(
    @Param('listingId') listingId: string,
    @Body() dto: CreateListingPromotionDto,
  ) {
    return this.listingPromotionService.createBanner(
      listingId,
      new Date(dto.startAt),
      new Date(dto.endAt),
    );
  }
}
