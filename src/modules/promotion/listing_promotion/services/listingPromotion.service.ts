import { Injectable } from '@nestjs/common';

import { ListingRepo } from '../../../listing/listing/repositories/listing.repo';
import { ListingPromotionRepo } from '../repositories/listingPromotion.repo';
import { ListingPromotion } from '../entities/listingPromotion.entity';
import { BusinessException } from '../../../../common/exceptions/business.exception';
import { CommonErrorCodes } from '../../../../common/errors/common-error-codes';
import { PromotionEnum } from '../entities/listingPromotion.entity';
@Injectable()
export class ListingPromotionService {
  constructor(
    private readonly listingRepository: ListingRepo,
    private readonly listingPromotionRepository: ListingPromotionRepo,
  ) {}
  async createBanner(
    listingId: string,
    startAt: Date,
    endAt: Date,
  ): Promise<ListingPromotion> {
    if (endAt <= startAt) {
      throw new BusinessException(
        CommonErrorCodes.VALIDATION_ERROR,
        'endAt must be greater than startAt',
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
      await this.listingPromotionRepository.findOverlappingByListingId(
        listingId,
        startAt,
        endAt,
      );
    if (listingOverlap) {
      throw new BusinessException(
        CommonErrorCodes.RESOURCE_CONFLICT,
        listingId,
      );
    }

    const listingPromotion = this.listingPromotionRepository.create({
      listing: listingPublic,
      listingId: listingId,
      promotionType: PromotionEnum.BANNER,
      startAt: startAt,
      endAt: endAt,
    });
    return this.listingPromotionRepository.save(listingPromotion);
  }
}
