/* eslint-disable @typescript-eslint/unbound-method */
import { ListingPromotionController } from './listing_promotion_controller';
import { ListingPromotionService } from '../services/listingPromotion.service';

describe('ListingPromotionController', () => {
  it('maps listing id and ISO date body to the service', async () => {
    const service = {
      createBanner: jest.fn().mockResolvedValue({ id: 'promotion-id' }),
    } as unknown as ListingPromotionService;
    const controller = new ListingPromotionController(service);
    const dto = {
      startAt: '2026-01-01T00:00:00.000Z',
      endAt: '2026-01-07T00:00:00.000Z',
    };

    await expect(controller.createBanner('listing-id', dto)).resolves.toEqual({
      id: 'promotion-id',
    });
    expect(service.createBanner).toHaveBeenCalledWith(
      'listing-id',
      new Date(dto.startAt),
      new Date(dto.endAt),
    );
  });
});
