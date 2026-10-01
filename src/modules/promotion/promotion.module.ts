import { Module } from '@nestjs/common';

import { CustomerModule } from '../customer/customer.module';
import { ListingModule } from '../listing/listing.module';
import { ProviderModule } from '../provider/provider.module';
import { ListingPromotionController } from './listing_promotion/controllers/listing_promotion_controller';
import { ListingPromotionRepo } from './listing_promotion/repositories/listingPromotion.repo';
import { ListingPromotionService } from './listing_promotion/services/listingPromotion.service';
import { PromotionRepo } from './promotion/repositories/promotion_repository';

@Module({
  imports: [ListingModule, CustomerModule, ProviderModule],
  controllers: [ListingPromotionController],
  providers: [ListingPromotionService, ListingPromotionRepo, PromotionRepo],
})
export class PromotionModule {}
