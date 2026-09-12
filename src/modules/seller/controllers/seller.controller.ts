import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { Public } from '../../../common/decorators/public.decorator';
import type { AuthenticatedPrincipal } from '../../../common/security/auth.types';
import { PermissionRequire } from '../../rbac/decorator/permission.decorator';
import { RoleRequire } from '../../rbac/decorator/roles.decorator';
import { PermissionsGuard } from '../../rbac/guard/permission.guard';
import { RoleGuard } from '../../rbac/guard/role.guard';
import { PERMISSIONS } from '../../../utils/constants/permission.constant';
import { ROLES } from '../../../utils/constants/role.constant';
import { RegisterSellerDto } from '../dto/register-seller.dto';
import { SellerRegistrationResponse } from '../dto/seller-registration.response';
import { RegisterSellerFromBuyerDto } from '../dto/register-seller-from-buyer.dto';
import { SellerProfileService } from '../services/seller-profile.service';
import { SellerRegistrationService } from '../services/seller-registration.service';
import type { SellerAccountResponse } from '../../seller-platform/account/dto/account.response';
import { BuyerJwtAuthGuard } from '../../buyer/auth/guards/buyer-jwt-auth.guard';

/** Seller onboarding and Seller Platform entry-point endpoints. */
@ApiTags('Seller')
@ApiBearerAuth()
@Controller('sellers')
@UseGuards(BuyerJwtAuthGuard, RoleGuard, PermissionsGuard)
export class SellerController {
  constructor(
    private readonly sellerProfileService: SellerProfileService,
    private readonly sellerRegistrationService: SellerRegistrationService,
  ) {}

  /** Registers a seller independently from an existing buyer account. */
  @Public()
  @Post('register')
  register(
    @Body() dto: RegisterSellerDto,
  ): Promise<SellerRegistrationResponse> {
    return this.sellerRegistrationService.registerIndependent(dto);
  }

  /** Submits a seller-registration request for the authenticated buyer. */
  @RoleRequire(ROLES.BUYER)
  @PermissionRequire(PERMISSIONS.SELLER_ACCOUNT_REGISTER)
  @Post('register/from-buyer')
  registerFromBuyer(
    @CurrentUser() buyer: AuthenticatedPrincipal,
    @Body() dto: RegisterSellerFromBuyerDto,
  ): Promise<SellerRegistrationResponse> {
    return this.sellerRegistrationService.requestFromBuyer(buyer.id, dto);
  }

  /** Returns the current seller account after seller authentication. */
  @RoleRequire(ROLES.SELLER)
  @PermissionRequire(PERMISSIONS.SELLER_ACCOUNT_READ)
  @Get('me')
  getCurrent(
    @CurrentUser() buyer: AuthenticatedPrincipal,
  ): Promise<SellerAccountResponse> {
    return this.sellerProfileService.getCurrent(buyer.id);
  }
}
