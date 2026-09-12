import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';

import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { Public } from '../../../common/decorators/public.decorator';
import type { AuthenticatedPrincipal } from '../../../common/security/auth.types';
import { PermissionRequire } from '../../rbac/decorator/permission.decorator';
import { RoleRequire } from '../../rbac/decorator/roles.decorator';
import { PermissionsGuard } from '../../rbac/guard/permission.guard';
import { RoleGuard } from '../../rbac/guard/role.guard';
import { PERMISSIONS } from '../../../utils';
import { ROLES } from '../../../utils';
import { CustomerService } from '../services/customer.service';
import { RegisterCustomerDto } from '../dto/register-customer.dto';
import type { SafeCustomerAccount } from '../types/customer-account.type';
import { CustomerJwtAuthGuard } from '../guards/customer-jwt-auth.guard';

/** Customer-facing registration and self-service endpoints. */
@Controller('customers')
@UseGuards(CustomerJwtAuthGuard, RoleGuard, PermissionsGuard)
export class CustomerController {
  constructor(private readonly customerService: CustomerService) {}

  /** Registers a customer without requiring an existing access token. */
  @Public()
  @Post('register')
  register(@Body() dto: RegisterCustomerDto): Promise<SafeCustomerAccount> {
    return this.customerService.register(dto);
  }

  /** Returns the current authenticated customer profile. */
  @RoleRequire(ROLES.CUSTOMER)
  @PermissionRequire(PERMISSIONS.CUSTOMER_PROFILE_READ)
  @Get('me')
  getCurrent(
    @CurrentUser() customer: AuthenticatedPrincipal,
  ): Promise<SafeCustomerAccount> {
    return this.customerService.getCurrent(customer.id);
  }
}
