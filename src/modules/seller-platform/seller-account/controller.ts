import { Body, Controller, Get, Patch, Post } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';

import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import type { AuthenticatedPrincipal } from '../../../modules/auth/types/auth.type';
import {
  CreateSellerAccountDto,
  SellerAccountResponse,
  UpdateSellerAccountDto,
} from './dto';
import { SellerAccountService } from './service';

@ApiTags('Seller Account')
@ApiBearerAuth()
@Controller('seller/account')
export class SellerAccountController {
  constructor(private readonly sellerAccountService: SellerAccountService) {}

  @Post()
  @ApiOperation({ summary: 'Create the authenticated user seller account' })
  @ApiCreatedResponse({ type: SellerAccountResponse })
  @ApiBadRequestResponse({
    description:
      'SELLER_ACCOUNT_INVALID_TYPE or SELLER_ACCOUNT_INVALID_DISPLAY_NAME',
  })
  @ApiConflictResponse({ description: 'SELLER_ACCOUNT_ALREADY_EXISTS' })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  create(
    @CurrentUser() user: AuthenticatedPrincipal,
    @Body() dto: CreateSellerAccountDto,
  ): Promise<SellerAccountResponse> {
    return this.sellerAccountService.create(user.id, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Get the authenticated user seller account' })
  @ApiOkResponse({ type: SellerAccountResponse })
  @ApiNotFoundResponse({ description: 'SELLER_ACCOUNT_NOT_FOUND' })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  getCurrent(
    @CurrentUser() user: AuthenticatedPrincipal,
  ): Promise<SellerAccountResponse> {
    return this.sellerAccountService.getCurrent(user.id);
  }

  @Patch()
  @ApiOperation({ summary: 'Update the seller account display name' })
  @ApiOkResponse({ type: SellerAccountResponse })
  @ApiBadRequestResponse({ description: 'SELLER_ACCOUNT_INVALID_DISPLAY_NAME' })
  @ApiNotFoundResponse({ description: 'SELLER_ACCOUNT_NOT_FOUND' })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  updateCurrent(
    @CurrentUser() user: AuthenticatedPrincipal,
    @Body() dto: UpdateSellerAccountDto,
  ): Promise<SellerAccountResponse> {
    return this.sellerAccountService.updateCurrent(user.id, dto);
  }
}
