import { Body, Controller, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { ListingPromotionService } from '../services/listingPromotion.service';
import { CreateListingPromotionDto } from '../dto/listing_promotion_dto';

@Controller('listings/:listingId/promotions')
export class ListingPromotionController {
  constructor(
    private readonly listingPromotionService: ListingPromotionService,
  ) {}

  @Post('baner')
  async createBanner(
    @Param('listingId', new ParseUUIDPipe()) listingId: string,
    promotionId: string,
    @Body() dto: CreateListingPromotionDto,
  ) {
    return this.listingPromotionService.createListingPromotion(
      listingId,
      promotionId,
      new Date(dto.startAt),
      new Date(dto.endAt),
    );
  }
}
