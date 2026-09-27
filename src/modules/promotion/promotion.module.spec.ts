jest.mock('../listing/listing.module', () => ({
  ListingModule: class ListingModule {},
}));

import { MODULE_METADATA } from '@nestjs/common/constants';
import { ListingPromotionController } from './listing_promotion/controllers/listing_promotion_controller';
import { ListingPromotionRepo } from './listing_promotion/repositories/listingPromotion.repo';
import { ListingPromotionService } from './listing_promotion/services/listingPromotion.service';
import { PromotionModule } from './promotion.module';
import { ListingModule } from '../listing/listing.module';

describe('PromotionModule', () => {
  it('imports ListingModule and wires the promotion adapter and providers', () => {
    expect(
      Reflect.getMetadata(MODULE_METADATA.IMPORTS, PromotionModule),
    ).toContain(ListingModule);
    expect(
      Reflect.getMetadata(MODULE_METADATA.CONTROLLERS, PromotionModule),
    ).toContain(ListingPromotionController);
    expect(
      Reflect.getMetadata(MODULE_METADATA.PROVIDERS, PromotionModule),
    ).toEqual(
      expect.arrayContaining([ListingPromotionService, ListingPromotionRepo]),
    );
  });
});
