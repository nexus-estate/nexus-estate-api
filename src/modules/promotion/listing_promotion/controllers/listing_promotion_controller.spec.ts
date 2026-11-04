/* eslint-disable @typescript-eslint/unbound-method */
import type { CustomerPrincipal } from '../../../../common/security/auth.types';
import { ListingPromotionController } from './listing_promotion_controller';
import { ListingPromotionService } from '../services/listingPromotion.service';

describe('ListingPromotionController', () => {
  it('maps provider context, listing id, promotion id, and duration to the service', async () => {
    const service = {
      createListingPromotion: jest
        .fn()
        .mockResolvedValue({ id: 'listing-promotion-id' }),
    } as unknown as ListingPromotionService;
    const controller = new ListingPromotionController(service);
    const user = {
      id: 'customer-id',
      email: 'provider@example.com',
      realm: 'customer',
    } as CustomerPrincipal;
    const dto = {
      durationDays: 6,
    };

    await expect(
      controller.create(user, 'listing-id', 'promotion-id', dto, 'provider-id'),
    ).resolves.toEqual({
      id: 'listing-promotion-id',
    });

    expect(service.createListingPromotion).toHaveBeenCalledWith(
      'customer-id',
      'listing-id',
      'promotion-id',
      dto.durationDays,
      'provider-id',
    );
  });
});
