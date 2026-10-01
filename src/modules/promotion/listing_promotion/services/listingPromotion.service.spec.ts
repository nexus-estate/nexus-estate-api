/* eslint-disable @typescript-eslint/unbound-method */
import { CommonErrorCodes } from '../../../../common/errors/common-error-codes';
import { Listing } from '../../../listing/listing/entities/listing.entity';
import { ListingRepo } from '../../../listing/listing/repositories/listing.repo';
import type { ProviderContext } from '../../../provider/account/services/provider-context.resolver';
import { ProviderContextResolver } from '../../../provider/account/services/provider-context.resolver';
import { ProviderSupplyAccessPolicy } from '../../../provider/authorization/helpers/provider-supply-access.policy';
import {
  Promotion,
  PromotionValueType,
} from '../../promotion/entities/promotion.entity';
import { PromotionRepo } from '../../promotion/repositories/promotion_repository';
import { ListingPromotion } from '../entities/listingPromotion.entity';
import { ListingPromotionRepo } from '../repositories/listingPromotion.repo';
import { ListingPromotionService } from './listingPromotion.service';

describe('ListingPromotionService', () => {
  const customerId = 'customer-id';
  const providerId = 'provider-id';
  const listingId = 'listing-id';
  const promotionId = 'promotion-id';
  const startAt = new Date('2026-01-01T00:00:00.000Z');
  const endAt = new Date('2026-01-07T00:00:00.000Z');
  const listing = { id: listingId, providerId } as Listing;
  const promotion = {
    id: promotionId,
    valueType: PromotionValueType.MONEY,
    moneyValue: 100000,
    isActive: true,
  } as Promotion;
  const context = {
    customerId,
    providerId,
  } as ProviderContext;

  function createService(overrides?: {
    listing?: Listing | null;
    promotion?: Promotion | null;
    overlap?: ListingPromotion | null;
    context?: ProviderContext;
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
      save: jest.fn((value: ListingPromotion) => Promise.resolve(value)),
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

    const providerContextResolver = {
      resolve: jest.fn().mockResolvedValue(overrides?.context ?? context),
    } as unknown as ProviderContextResolver;

    const supplyAccessPolicy = {
      requirePermission: jest.fn().mockResolvedValue(undefined),
    } as unknown as ProviderSupplyAccessPolicy;

    return {
      service: new ListingPromotionService(
        listingRepository,
        listingPromotionRepository,
        promotionRepository,
        providerContextResolver,
        supplyAccessPolicy,
      ),
      listingRepository,
      listingPromotionRepository,
      promotionRepository,
      providerContextResolver,
      supplyAccessPolicy,
    };
  }

  const createPromotion = (
    service: ListingPromotionService,
    selectedListingId = listingId,
    selectedStartAt = startAt,
    selectedEndAt = endAt,
  ) =>
    service.createListingPromotion(
      customerId,
      selectedListingId,
      promotionId,
      selectedStartAt,
      selectedEndAt,
      providerId,
    );

  it('creates a promotion for a published provider-owned listing', async () => {
    const {
      service,
      listingRepository,
      listingPromotionRepository,
      providerContextResolver,
      supplyAccessPolicy,
    } = createService();

    const result = await createPromotion(service);

    expect(providerContextResolver.resolve).toHaveBeenCalledWith(
      customerId,
      providerId,
    );
    expect(supplyAccessPolicy.requirePermission).toHaveBeenCalledWith(
      context,
      'listing:publish',
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
  });

  it('rejects a listing owned by another provider', async () => {
    const { service, listingPromotionRepository } = createService({
      listing: {
        ...listing,
        providerId: 'another-provider-id',
      } as Listing,
    });

    await expect(createPromotion(service)).rejects.toMatchObject({
      errorCode: CommonErrorCodes.FORBIDDEN.code,
    });
    expect(listingPromotionRepository.create).not.toHaveBeenCalled();
  });

  it('rejects when the listing is not public', async () => {
    const { service, listingPromotionRepository } = createService({
      listing: null,
    });

    await expect(createPromotion(service)).rejects.toMatchObject({
      errorCode: CommonErrorCodes.RESOURCE_NOT_FOUND.code,
    });
    expect(listingPromotionRepository.create).not.toHaveBeenCalled();
  });

  it('rejects an invalid time range before resolving provider context', async () => {
    const { service, providerContextResolver, listingRepository } =
      createService();

    await expect(
      createPromotion(service, listingId, endAt, startAt),
    ).rejects.toMatchObject({
      errorCode: CommonErrorCodes.VALIDATION_ERROR.code,
    });
    expect(providerContextResolver.resolve).not.toHaveBeenCalled();
    expect(listingRepository.findById).not.toHaveBeenCalled();
  });

  it('rejects an overlapping promotion', async () => {
    const { service, listingPromotionRepository } = createService({
      overlap: { id: 'existing-promotion' } as ListingPromotion,
    });

    await expect(createPromotion(service)).rejects.toMatchObject({
      errorCode: CommonErrorCodes.RESOURCE_CONFLICT.code,
    });
    expect(listingPromotionRepository.create).not.toHaveBeenCalled();
  });

  it('allows an adjacent promotion at the existing end timestamp', async () => {
    const { service, listingPromotionRepository } = createService();
    const adjacentStart = endAt;
    const adjacentEnd = new Date('2026-01-10T00:00:00.000Z');

    await expect(
      createPromotion(service, listingId, adjacentStart, adjacentEnd),
    ).resolves.toMatchObject({
      startAt: adjacentStart,
      endAt: adjacentEnd,
    });

    expect(
      listingPromotionRepository.findOverlappingByListingAndPromotion,
    ).toHaveBeenCalledWith(
      listingId,
      promotionId,
      adjacentStart,
      adjacentEnd,
    );
  });

  it('rejects unknown and inactive promotions', async () => {
    const unknown = createService({ promotion: null });

    await expect(createPromotion(unknown.service)).rejects.toMatchObject({
      errorCode: CommonErrorCodes.RESOURCE_NOT_FOUND.code,
    });

    const inactive = createService({
      promotion: { ...promotion, isActive: false },
    });

    await expect(createPromotion(inactive.service)).rejects.toMatchObject({
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

    await createPromotion(service, listingId, startAt, selectedEndAt);

    expect(listingPromotionRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ priceSnapshot: expectedPrice }),
    );
  });

  it('uses the validated promotion id for the booking', async () => {
    const { service, listingPromotionRepository } = createService({
      promotion: { ...promotion, id: 'validated-id' },
    });

    await createPromotion(service);

    expect(
      listingPromotionRepository.findOverlappingByListingAndPromotion,
    ).toHaveBeenCalledWith(listingId, 'validated-id', startAt, endAt);
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

    await expect(createPromotion(service)).rejects.toMatchObject({
      errorCode: CommonErrorCodes.RESOURCE_CONFLICT.code,
    });
    expect(listingPromotionRepository.create).not.toHaveBeenCalled();
  });

  it('rejects MONEY promotions without moneyValue', async () => {
    const { service, listingPromotionRepository } = createService({
      promotion: { ...promotion, moneyValue: null } as unknown as Promotion,
    });

    await expect(createPromotion(service)).rejects.toMatchObject({
      errorCode: CommonErrorCodes.RESOURCE_CONFLICT.code,
    });
    expect(listingPromotionRepository.create).not.toHaveBeenCalled();
  });
});
