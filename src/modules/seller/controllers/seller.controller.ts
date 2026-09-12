import { Body, Controller, Get, Post } from '@nestjs/common';

import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { Public } from '../../../common/decorators/public.decorator';
import type { AuthenticatedPrincipal } from '../../auth/types/auth.type';
import { PermissionRequire } from '../../rbac/decorator/permission.decorator';
import { RoleRequire } from '../../rbac/decorator/roles.decorator';
import { PERMISSIONS, ROLES } from '../../../utils';
import { CreateSellerFromBuyerDto } from '../dto/create-seller-from-buyer.dto';
import { RegisterSellerDto } from '../dto/register-seller.dto';
import { SellerRegistrationResponse } from '../dto/seller-registration.response';
import { SellerService } from '../services/seller.service';
import type { SellerAccountResponse } from '../../seller-platform/account/dto/account.response';

/** Seller onboarding and Seller Platform entry-point endpoints. */
@Controller('sellers')
export class SellerController {
  constructor(private readonly sellerService: SellerService) {}

  /** Registers a seller independently from an existing buyer user. */
  @Public()
  @Post('register')
  register(
    @Body() dto: RegisterSellerDto,
  ): Promise<SellerRegistrationResponse> {
    return this.sellerService.register(dto);
  }

  /** Returns the current seller account after seller authentication. */
  @RoleRequire(ROLES.SELLER)
  @PermissionRequire(PERMISSIONS.SELLER_ACCOUNT_READ)
  @Get('me')
  getCurrent(
    @CurrentUser() user: AuthenticatedPrincipal,
  ): Promise<SellerAccountResponse> {
    return this.sellerService.getCurrent(user.id);
  }

  /** Promotes an existing buyer through the administrator workflow. */
  @RoleRequire(ROLES.ADMINISTRATOR)
  @PermissionRequire(PERMISSIONS.SELLER_ACCOUNT_APPROVE)
  @Post('from-buyer')
  createFromBuyer(
    @Body() dto: CreateSellerFromBuyerDto,
  ): Promise<SellerRegistrationResponse> {
    return this.sellerService.createFromBuyer(dto);
  }
}
