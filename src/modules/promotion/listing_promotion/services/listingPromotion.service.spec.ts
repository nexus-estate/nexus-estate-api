/* eslint-disable @typescript-eslint/unbound-method */
import { CommonErrorCodes } from '../../../../common/errors/common-error-codes';
import { Listing } from '../../../listing/listing/entities/listing.entity';
import { ListingRepo } from '../../../listing/listing/repositories/listing.repo';
import {
  Promotion,
  PromotionValueType,
} from '../../promotion/entities/promotion.entity';
import { PromotionRepo } from '../../promotion/repositories/promotion_repository';
import { ListingPromotion } from '../entities/listingPromotion.entity';
import { ListingPromotionRepo } from '../repositories/listingPromotion.repo';
import { ListingPromotionService } from './listingPromotion.service';

describe('ListingPromotionService', () => {
  const listingId = 'listing-id';
  const promotionId = 'promotion-id';
  const startAt = new Date('2026-01-01T00:00:00.000Z');
  const endAt = new Date('2026-01-07T00:00:00.000Z');
  const listing = { id: listingId } as Listing;
  const promotion = {
    id: promotionId,
    valueType: PromotionValueType.MONEY,
    moneyValue: 100000,
    isActive: true,
  } as Promotion;

  function createService(overrides?: {
    listing?: Listing | null;
    promotion?: Promotion | null;
    overlap?: ListingPromotion | null;
  }) {
    const listingRepository = {
      findById: jest
        .fn()
        .mockResolvedValue(
          overrides && 'listing' in overrides ? overrides.listing : listing,
        ),
    } as unknown as ListingRepo;
    const listingPromotionRepository = {
      findOverlappingByListingAndPromotion: jest
        .fn()
        .mockResolvedValue(overrides?.overlap ?? null),
      create: jest.fn((data: Partial<ListingPromotion>) => data),
      save: jest.fn((promotion: ListingPromotion) =>
        Promise.resolve(promotion),
      ),
    } as unknown as ListingPromotionRepo;
    const promotionRepository = {
      findById: jest
        .fn()
        .mockResolvedValue(
          overrides && 'promotion' in overrides
            ? overrides.promotion
            : promotion,
        ),
    } as unknown as PromotionRepo;

    return {
      service: new ListingPromotionService(
        listingRepository,
        listingPromotionRepository,
        promotionRepository,
      ),
      listingRepository,
      listingPromotionRepository,
      promotionRepository,
    };
  }

  it('creates a Banner for a published listing and preserves relation and fields', async () => {
    const { service, listingRepository, listingPromotionRepository } =
      createService();

    const result = await service.createListingPromotion(
      listingId,
      promotionId,
      startAt,
      endAt,
    );

    expect(listingRepository.findById).toHaveBeenCalledWith(listingId, true);
    expect(listingPromotionRepository.create).toHaveBeenCalledWith({
      listing,
      listingId,
      promotionId,
      priceSnapshot: 600000,
      startAt,
      endAt,
    });
    expect(listingPromotionRepository.save).toHaveBeenCalledWith(result);
    expect(result).toMatchObject({
      listing,
      listingId,
      promotionId,
      priceSnapshot: 600000,
      startAt,
      endAt,
    });
  });

  it.each([
    ['listing does not exist', null],
    ['listing is not public', null],
  ])('rejects when %s', async (_description, listingValue) => {
    const { service, listingPromotionRepository } = createService({
      listing: listingValue,
    });

    await expect(
      service.createListingPromotion(listingId, promotionId, startAt, endAt),
    ).rejects.toMatchObject({
      errorCode: CommonErrorCodes.RESOURCE_NOT_FOUND.code,
    });
    expect(listingPromotionRepository.create).not.toHaveBeenCalled();
  });

  it('rejects an invalid time range', async () => {
    const { service, listingRepository } = createService();

    await expect(
      service.createListingPromotion(listingId, promotionId, endAt, startAt),
    ).rejects.toMatchObject({
      errorCode: CommonErrorCodes.VALIDATION_ERROR.code,
    });
    expect(listingRepository.findById).not.toHaveBeenCalled();
  });

  it('rejects an overlapping promotion', async () => {
    const { service, listingPromotionRepository } = createService({
      overlap: { id: 'existing-promotion' } as ListingPromotion,
    });

    await expect(
      service.createListingPromotion(listingId, promotionId, startAt, endAt),
    ).rejects.toMatchObject({
      errorCode: CommonErrorCodes.RESOURCE_CONFLICT.code,
    });
    expect(listingPromotionRepository.create).not.toHaveBeenCalled();
  });

  it('allows an adjacent promotion at the existing end timestamp', async () => {
    const { service, listingPromotionRepository } = createService();
    const adjacentStart = endAt;
    const adjacentEnd = new Date('2026-01-10T00:00:00.000Z');

    await expect(
      service.createListingPromotion(
        listingId,
        promotionId,
        adjacentStart,
        adjacentEnd,
      ),
    ).resolves.toMatchObject({ startAt: adjacentStart, endAt: adjacentEnd });
    expect(
      listingPromotionRepository.findOverlappingByListingAndPromotion,
    ).toHaveBeenCalledWith(listingId, promotionId, adjacentStart, adjacentEnd);
  });

  it('allows a promotion belonging to another listing', async () => {
    const { service, listingPromotionRepository } = createService();

    await expect(
      service.createListingPromotion(
        'another-listing-id',
        promotionId,
        startAt,
        endAt,
      ),
    ).resolves.toMatchObject({ listingId: 'another-listing-id' });
    expect(
      listingPromotionRepository.findOverlappingByListingAndPromotion,
    ).toHaveBeenCalledWith('another-listing-id', promotionId, startAt, endAt);
  });

  it('rejects unknown and inactive promotions', async () => {
    const unknown = createService({ promotion: null });
    await expect(
      unknown.service.createListingPromotion(
        listingId,
        promotionId,
        startAt,
        endAt,
      ),
    ).rejects.toMatchObject({
      errorCode: CommonErrorCodes.RESOURCE_NOT_FOUND.code,
    });
    const inactive = createService({
      promotion: { ...promotion, isActive: false },
    });
    await expect(
      inactive.service.createListingPromotion(
        listingId,
        promotionId,
        startAt,
        endAt,
      ),
    ).rejects.toMatchObject({
      errorCode: CommonErrorCodes.RESOURCE_CONFLICT.code,
    });
  });

  it.each([
    [24, 100000],
    [48, 200000],
    [30, 125000],
  ])('calculates %s hours as %s', async (hours, expectedPrice) => {
    const { service, listingPromotionRepository } = createService();
    const selectedEndAt = new Date(startAt.getTime() + hours * 60 * 60 * 1000);
    await service.createListingPromotion(
      listingId,
      promotionId,
      startAt,
      selectedEndAt,
    );
    expect(listingPromotionRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ priceSnapshot: expectedPrice }),
    );
  });

  it('uses the validated promotion id for a later booking', async () => {
    const { service, listingPromotionRepository } = createService({
      promotion: { ...promotion, id: 'validated-id' },
    });
    const laterStartAt = endAt;
    const laterEndAt = new Date('2026-01-08T00:00:00.000Z');
    await service.createListingPromotion(
      listingId,
      promotionId,
      laterStartAt,
      laterEndAt,
    );
    expect(
      listingPromotionRepository.findOverlappingByListingAndPromotion,
    ).toHaveBeenCalledWith(listingId, 'validated-id', laterStartAt, laterEndAt);
    expect(listingPromotionRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ promotionId: 'validated-id' }),
    );
  });
  it('rejects TEXT promotions', async () => {
    const { service, listingPromotionRepository } = createService({
      promotion: {
        ...promotion,
        valueType: PromotionValueType.TEXT,
        textValue: 'copy',
      },
    });
    await expect(
      service.createListingPromotion(listingId, promotionId, startAt, endAt),
    ).rejects.toMatchObject({
      errorCode: CommonErrorCodes.RESOURCE_CONFLICT.code,
    });
    expect(listingPromotionRepository.create).not.toHaveBeenCalled();
  });

  it('rejects MONEY promotions without moneyValue', async () => {
    const { service, listingPromotionRepository } = createService({
      promotion: { ...promotion, moneyValue: null } as unknown as Promotion,
    });
    await expect(
      service.createListingPromotion(listingId, promotionId, startAt, endAt),
    ).rejects.toMatchObject({
      errorCode: CommonErrorCodes.RESOURCE_CONFLICT.code,
    });
    expect(listingPromotionRepository.create).not.toHaveBeenCalled();
  });

  it('calculates priceSnapshot for a valid MONEY promotion', async () => {
    const { service, listingPromotionRepository } = createService({
      promotion: { ...promotion, moneyValue: 100000 },
    });
    const selectedEndAt = new Date(startAt.getTime() + 30 * 60 * 60 * 1000);
    await service.createListingPromotion(
      listingId,
      promotionId,
      startAt,
      selectedEndAt,
    );
    expect(listingPromotionRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ priceSnapshot: 125000 }),
    );
  });
});
