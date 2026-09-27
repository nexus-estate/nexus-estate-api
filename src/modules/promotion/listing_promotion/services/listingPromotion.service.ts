import { Injectable } from '@nestjs/common';

import { ListingRepo } from '../../../listing/listing/repositories/listing.repo';
import { ListingPromotionRepo } from '../repositories/listingPromotion.repo';
import { ListingPromotion } from '../entities/listingPromotion.entity';
import { BusinessException } from '../../../../common/exceptions/business.exception';
import { CommonErrorCodes } from '../../../../common/errors/common-error-codes';
import { PromotionValueType } from '../../promotion/entities/promotion.entity';
import { PromotionRepo } from '../../promotion/repositories/promotion_repository';
@Injectable()
export class ListingPromotionService {
  constructor(
    private readonly listingRepository: ListingRepo,
    private readonly listingPromotionRepository: ListingPromotionRepo,
    private readonly promotionRepository: PromotionRepo,
  ) {}
  async createListingPromotion(
    listingId: string,
    promotionId: string,
    startAt: Date,
    endAt: Date,
  ): Promise<ListingPromotion> {
    if (endAt <= startAt) {
      throw new BusinessException(
        CommonErrorCodes.VALIDATION_ERROR,
        'endAt must be greater than startAt',
      );
    }

    const promotion = await this.promotionRepository.findById(promotionId);
    if (!promotion) {
      throw new BusinessException(
        CommonErrorCodes.RESOURCE_NOT_FOUND,
        promotionId,
      );
    }
    if (!promotion.isActive) {
      throw new BusinessException(
        CommonErrorCodes.RESOURCE_CONFLICT,
        promotionId,
      );
    }
    if (
      promotion.valueType !== PromotionValueType.MONEY ||
      promotion.moneyValue === null
    ) {
      throw new BusinessException(
        CommonErrorCodes.RESOURCE_CONFLICT,
        promotionId,
      );
    }

    const listingPublic = await this.listingRepository.findById(
      listingId,
      true,
    );
    if (!listingPublic) {
      throw new BusinessException(
        CommonErrorCodes.RESOURCE_NOT_FOUND,
        listingId,
      );
    }

    const listingOverlap =
      await this.listingPromotionRepository.findOverlappingByListingAndPromotion(
        listingId,
        promotion.id,
        startAt,
        endAt,
      );
    if (listingOverlap) {
      throw new BusinessException(
        CommonErrorCodes.RESOURCE_CONFLICT,
        listingId,
      );
    }
    const durationMs = endAt.getTime() - startAt.getTime();
    const durationHours = durationMs / (1000 * 60 * 60);

    const pricePerHour = promotion.moneyValue / 24;

    const priceSnapshot = Math.round(durationHours * pricePerHour);
    // Price

    const listingPromotion = this.listingPromotionRepository.create({
      listing: listingPublic,
      listingId: listingId,
      promotionId: promotion.id,
      priceSnapshot: priceSnapshot,
      startAt: startAt,
      endAt: endAt,
    });
    return this.listingPromotionRepository.save(listingPromotion);
  }
}
