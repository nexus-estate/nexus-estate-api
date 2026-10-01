import {
  Body,
  Controller,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiHeader,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';

import { CurrentUser } from '../../../../common/decorators/current-user.decorator';
import { ProviderId } from '../../../../common/decorators/provider-id.decorator';
import type { CustomerPrincipal } from '../../../../common/security/auth.types';
import { CustomerJwtAuthGuard } from '../../../customer/authentication/guards/customer-jwt-auth.guard';
import { CreateListingPromotionDto } from '../dto/listing_promotion_dto';
import { ListingPromotionService } from '../services/listingPromotion.service';

@ApiTags('Listing Promotions')
@Controller('listings/:listingId/promotions')
export class ListingPromotionController {
  constructor(
    private readonly listingPromotionService: ListingPromotionService,
  ) {}

  @Post(':promotionId')
  @UseGuards(CustomerJwtAuthGuard)
  @ApiBearerAuth()
  @ApiHeader({ name: 'X-Provider-Id', required: false })
  @ApiParam({ name: 'listingId', format: 'uuid' })
  @ApiParam({ name: 'promotionId', format: 'uuid' })
  @ApiOperation({ summary: 'Apply a promotion to a provider-owned listing' })
  @ApiForbiddenResponse({
    description:
      'Provider lifecycle, listing ownership, or listing:publish permission denied.',
  })
  create(
    @CurrentUser() user: CustomerPrincipal,
    @Param('listingId', new ParseUUIDPipe()) listingId: string,
    @Param('promotionId', new ParseUUIDPipe()) promotionId: string,
    @Body() dto: CreateListingPromotionDto,
    @ProviderId() providerId?: string,
  ) {
    return this.listingPromotionService.createListingPromotion(
      user.id,
      listingId,
      promotionId,
      new Date(dto.startAt),
      new Date(dto.endAt),
      providerId,
    );
  }
}
