import { ListingPromotionRepo } from './listing_promotion/repositories/listingPromotion.repo';
import { ListingPromotionService } from './listing_promotion/services/listingPromotion.service';
import { Module } from '@nestjs/common';
import { ListingModule } from '../listing/listing.module';
import { ListingPromotionController } from './listing_promotion/controllers/listing_promotion_controller';

@Module({
  imports: [ListingModule],
  controllers: [ListingPromotionController],
  providers: [ListingPromotionService, ListingPromotionRepo],
})
export class PromotionModule {}
