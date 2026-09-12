import { Body, Controller, Get, Post } from '@nestjs/common';

import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { Public } from '../../../common/decorators/public.decorator';
import type { AuthenticatedPrincipal } from '../../auth/types/auth.type';
import { PermissionRequire } from '../../rbac/decorator/permission.decorator';
import { RoleRequire } from '../../rbac/decorator/roles.decorator';
import { PERMISSIONS, ROLES } from '../../../utils';
import { BuyerService } from '../services/buyer.service';
import { RegisterBuyerDto } from '../dto/register-buyer.dto';
import type { SafeUser } from '../../user/types/user.type';

/** Buyer-facing registration and self-service endpoints. */
@Controller('buyers')
export class BuyerController {
  constructor(private readonly buyerService: BuyerService) {}

  /** Registers a buyer without requiring an existing access token. */
  @Public()
  @Post('register')
  register(@Body() dto: RegisterBuyerDto): Promise<SafeUser> {
    return this.buyerService.register(dto);
  }

  /** Returns the current authenticated buyer profile. */
  @RoleRequire(ROLES.BUYER)
  @PermissionRequire(PERMISSIONS.BUYER_PROFILE_READ)
  @Get('me')
  getCurrent(@CurrentUser() user: AuthenticatedPrincipal): Promise<SafeUser> {
    return this.buyerService.getCurrent(user.id);
  }
}
