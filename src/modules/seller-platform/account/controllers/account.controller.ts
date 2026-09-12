import { Body, Controller, Get, Patch, Post, UseGuards } from '@nestjs/common';
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

import { CurrentUser } from '../../../../common/decorators/current-user.decorator';
import type { AuthenticatedPrincipal } from '../../../../common/security/auth.types';
import { PermissionRequire } from '../../../../modules/rbac/decorator/permission.decorator';
import { PermissionsGuard } from '../../../../modules/rbac/guard/permission.guard';
import { RoleGuard } from '../../../../modules/rbac/guard/role.guard';
import { PERMISSIONS } from '../../../../utils/constants/permission.constant';
import {
  CreateSellerAccountDto,
  SellerAccountResponse,
  UpdateSellerAccountDto,
} from '../dto';
import { SellerAccountService } from '../services/account.service';
import { BuyerJwtAuthGuard } from '../../../../modules/buyer/auth/guards/buyer-jwt-auth.guard';

/** HTTP endpoints for the authenticated buyer's seller account. */
@ApiTags('Seller Account')
@ApiBearerAuth()
@Controller('seller/account')
@UseGuards(BuyerJwtAuthGuard, RoleGuard, PermissionsGuard)
export class SellerAccountController {
  constructor(private readonly sellerAccountService: SellerAccountService) {}

  @Post()
  @ApiOperation({ summary: 'Create the authenticated buyer seller account' })
  @ApiCreatedResponse({ type: SellerAccountResponse })
  @ApiBadRequestResponse({
    description:
      'SELLER_ACCOUNT_INVALID_TYPE or SELLER_ACCOUNT_INVALID_DISPLAY_NAME',
  })
  @ApiConflictResponse({ description: 'SELLER_ACCOUNT_ALREADY_EXISTS' })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  @PermissionRequire(PERMISSIONS.SELLER_ACCOUNT_REGISTER)
  /** Creates the seller account for the authenticated buyer. */
  create(
    @CurrentUser() buyer: AuthenticatedPrincipal,
    @Body() dto: CreateSellerAccountDto,
  ): Promise<SellerAccountResponse> {
    return this.sellerAccountService.createForBuyer(buyer.id, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Get the authenticated buyer seller account' })
  @ApiOkResponse({ type: SellerAccountResponse })
  @ApiNotFoundResponse({ description: 'SELLER_ACCOUNT_NOT_FOUND' })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  @PermissionRequire(PERMISSIONS.SELLER_ACCOUNT_READ)
  /** Returns the seller account owned by the authenticated buyer. */
  getCurrent(
    @CurrentUser() buyer: AuthenticatedPrincipal,
  ): Promise<SellerAccountResponse> {
    return this.sellerAccountService.getCurrent(buyer.id);
  }

  @Patch()
  @ApiOperation({ summary: 'Update the seller account display name' })
  @ApiOkResponse({ type: SellerAccountResponse })
  @ApiBadRequestResponse({ description: 'SELLER_ACCOUNT_INVALID_DISPLAY_NAME' })
  @ApiNotFoundResponse({ description: 'SELLER_ACCOUNT_NOT_FOUND' })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  @PermissionRequire(PERMISSIONS.SELLER_ACCOUNT_UPDATE)
  /** Updates the editable profile fields of the authenticated buyer's account. */
  updateCurrent(
    @CurrentUser() buyer: AuthenticatedPrincipal,
    @Body() dto: UpdateSellerAccountDto,
  ): Promise<SellerAccountResponse> {
    return this.sellerAccountService.updateCurrent(buyer.id, dto);
  }
}
