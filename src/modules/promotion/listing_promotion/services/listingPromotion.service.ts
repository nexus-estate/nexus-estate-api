import { Injectable } from '@nestjs/common';

import { BusinessException } from '../../../../common/exceptions/business.exception';
import { CommonErrorCodes } from '../../../../common/errors/common-error-codes';
import { ListingRepo } from '../../../listing/listing/repositories/listing.repo';
import { ProviderContextResolver } from '../../../provider/account/services/provider-context.resolver';
import { ProviderSupplyAccessPolicy } from '../../../provider/authorization/helpers/provider-supply-access.policy';
import {
  PromotionValueType,
} from '../../promotion/entities/promotion.entity';
import { PromotionRepo } from '../../promotion/repositories/promotion_repository';
import { ListingPromotion } from '../entities/listingPromotion.entity';
import { ListingPromotionRepo } from '../repositories/listingPromotion.repo';

@Injectable()
export class ListingPromotionService {
  constructor(
    private readonly listingRepository: ListingRepo,
    private readonly listingPromotionRepository: ListingPromotionRepo,
    private readonly promotionRepository: PromotionRepo,
    private readonly providerContextResolver: ProviderContextResolver,
    private readonly supplyAccessPolicy: ProviderSupplyAccessPolicy,
  ) {}

  async createListingPromotion(
    customerId: string,
    listingId: string,
    promotionId: string,
    startAt: Date,
    endAt: Date,
    providerId?: string,
  ): Promise<ListingPromotion> {
    if (endAt <= startAt) {
      throw new BusinessException(
        CommonErrorCodes.VALIDATION_ERROR,
        'endAt must be greater than startAt',
      );
    }

    const context = await this.providerContextResolver.resolve(
      customerId,
      providerId,
    );
    await this.supplyAccessPolicy.requirePermission(context, 'listing:publish');

    const listing = await this.listingRepository.findById(listingId, true);
    if (!listing) {
      throw new BusinessException(
        CommonErrorCodes.RESOURCE_NOT_FOUND,
        listingId,
      );
    }
    if (listing.providerId !== context.providerId) {
      throw new BusinessException(
        CommonErrorCodes.FORBIDDEN,
        context.providerId,
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
    const pricePerHour = Number(promotion.moneyValue) / 24;
    const priceSnapshot = Math.round(durationHours * pricePerHour);

    const listingPromotion = this.listingPromotionRepository.create({
      listing,
      listingId,
      promotionId: promotion.id,
      priceSnapshot,
      startAt,
      endAt,
    });

    return this.listingPromotionRepository.save(listingPromotion);
  }
}
