/* eslint-disable @typescript-eslint/unbound-method */
import { CommonErrorCodes } from '../../../../common/errors/common-error-codes';
import { Listing } from '../../../listing/listing/entities/listing.entity';
import { ListingRepo } from '../../../listing/listing/repositories/listing.repo';
import { ListingPromotion } from '../entities/listingPromotion.entity';
import { ListingPromotionRepo } from '../repositories/listingPromotion.repo';
import { ListingPromotionService } from './listingPromotion.service';

describe('ListingPromotionService', () => {
  const listingId = 'listing-id';
  const startAt = new Date('2026-01-01T00:00:00.000Z');
  const endAt = new Date('2026-01-07T00:00:00.000Z');
  const listing = { id: listingId } as Listing;

  function createService(overrides?: {
    listing?: Listing | null;
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
      findOverlappingByListingId: jest
        .fn()
        .mockResolvedValue(overrides?.overlap ?? null),
      create: jest.fn((data: Partial<ListingPromotion>) => data),
      save: jest.fn((promotion: ListingPromotion) =>
        Promise.resolve(promotion),
      ),
    } as unknown as ListingPromotionRepo;

    return {
      service: new ListingPromotionService(
        listingRepository,
        listingPromotionRepository,
      ),
      listingRepository,
      listingPromotionRepository,
    };
  }

  it('creates a Banner for a published listing and preserves relation and fields', async () => {
    const { service, listingRepository, listingPromotionRepository } =
      createService();

    const result = await service.createBanner(listingId, startAt, endAt);

    expect(listingRepository.findById).toHaveBeenCalledWith(listingId, true);
    expect(listingPromotionRepository.create).toHaveBeenCalledWith({
      listing,
      listingId,
      promotionType: 'BANNER',
      startAt,
      endAt,
    });
    expect(listingPromotionRepository.save).toHaveBeenCalledWith(result);
    expect(result).toMatchObject({
      listing,
      listingId,
      promotionType: 'BANNER',
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
      service.createBanner(listingId, startAt, endAt),
    ).rejects.toMatchObject({
      errorCode: CommonErrorCodes.RESOURCE_NOT_FOUND.code,
    });
    expect(listingPromotionRepository.create).not.toHaveBeenCalled();
  });

  it('rejects an invalid time range', async () => {
    const { service, listingRepository } = createService();

    await expect(
      service.createBanner(listingId, endAt, startAt),
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
      service.createBanner(listingId, startAt, endAt),
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
      service.createBanner(listingId, adjacentStart, adjacentEnd),
    ).resolves.toMatchObject({ startAt: adjacentStart, endAt: adjacentEnd });
    expect(
      listingPromotionRepository.findOverlappingByListingId,
    ).toHaveBeenCalledWith(listingId, adjacentStart, adjacentEnd);
  });

  it('allows a promotion belonging to another listing', async () => {
    const { service, listingPromotionRepository } = createService();

    await expect(
      service.createBanner('another-listing-id', startAt, endAt),
    ).resolves.toMatchObject({ listingId: 'another-listing-id' });
    expect(
      listingPromotionRepository.findOverlappingByListingId,
    ).toHaveBeenCalledWith('another-listing-id', startAt, endAt);
  });
});
