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
import { RegisterProviderDto } from '../dto/register-provider.dto';
import { ProviderRegistrationResponse } from '../dto/provider-registration.response';
import { RegisterProviderFromCustomerDto } from '../dto/register-provider-from-customer.dto';
import { ProviderProfileService } from '../services/provider-profile.service';
import { ProviderRegistrationService } from '../services/provider-registration.service';
import type { ProviderAccountResponse } from '../dto/provider-account.response';
import { CustomerJwtAuthGuard } from '../../customer/guards/customer-jwt-auth.guard';

/** Provider onboarding and provider-platform entry-point endpoints. */
@ApiTags('Provider')
@ApiBearerAuth()
@Controller('providers')
@UseGuards(CustomerJwtAuthGuard, RoleGuard, PermissionsGuard)
export class ProviderController {
  constructor(
    private readonly providerProfileService: ProviderProfileService,
    private readonly providerRegistrationService: ProviderRegistrationService,
  ) {}

  /** Registers a customer identity and submits a provider request. */
  @Public()
  @Post('register')
  register(
    @Body() dto: RegisterProviderDto,
  ): Promise<ProviderRegistrationResponse> {
    return this.providerRegistrationService.registerIndependent(dto);
  }

  /** Submits a provider-registration request for the authenticated customer. */
  @RoleRequire(ROLES.CUSTOMER)
  @PermissionRequire(PERMISSIONS.PROVIDER_ACCOUNT_REGISTER)
  @Post('register/from-customer')
  registerFromCustomer(
    @CurrentUser() customer: AuthenticatedPrincipal,
    @Body() dto: RegisterProviderFromCustomerDto,
  ): Promise<ProviderRegistrationResponse> {
    return this.providerRegistrationService.requestFromCustomer(customer.id, dto);
  }

  /** Returns the owned provider account, including pending onboarding state. */
  @PermissionRequire(PERMISSIONS.PROVIDER_ACCOUNT_READ)
  @Get('me')
  getCurrent(
    @CurrentUser() customer: AuthenticatedPrincipal,
  ): Promise<ProviderAccountResponse> {
    return this.providerProfileService.getCurrent(customer.id);
  }
}
