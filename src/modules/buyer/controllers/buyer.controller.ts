import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';

import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { Public } from '../../../common/decorators/public.decorator';
import type { AuthenticatedPrincipal } from '../../../common/security/auth.types';
import { PermissionRequire } from '../../rbac/decorator/permission.decorator';
import { RoleRequire } from '../../rbac/decorator/roles.decorator';
import { PermissionsGuard } from '../../rbac/guard/permission.guard';
import { RoleGuard } from '../../rbac/guard/role.guard';
import { PERMISSIONS } from '../../../utils/constants/permission.constant';
import { ROLES } from '../../../utils/constants/role.constant';
import { BuyerService } from '../services/buyer.service';
import { RegisterBuyerDto } from '../dto/register-buyer.dto';
import type { SafeBuyerAccount } from '../account/types/buyer-account.type';
import { BuyerJwtAuthGuard } from '../auth/guards/buyer-jwt-auth.guard';

/** Buyer-facing registration and self-service endpoints. */
@Controller('buyers')
@UseGuards(BuyerJwtAuthGuard, RoleGuard, PermissionsGuard)
export class BuyerController {
  constructor(private readonly buyerService: BuyerService) {}

  /** Registers a buyer without requiring an existing access token. */
  @Public()
  @Post('register')
  register(@Body() dto: RegisterBuyerDto): Promise<SafeBuyerAccount> {
    return this.buyerService.register(dto);
  }

  /** Returns the current authenticated buyer profile. */
  @RoleRequire(ROLES.BUYER)
  @PermissionRequire(PERMISSIONS.BUYER_PROFILE_READ)
  @Get('me')
  getCurrent(
    @CurrentUser() buyer: AuthenticatedPrincipal,
  ): Promise<SafeBuyerAccount> {
    return this.buyerService.getCurrent(buyer.id);
  }
}
