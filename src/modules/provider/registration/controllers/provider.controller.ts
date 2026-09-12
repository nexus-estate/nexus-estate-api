import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { CurrentUser } from '../../../../common/decorators/current-user.decorator';
import { Public } from '../../../../common/decorators/public.decorator';
import type { CustomerPrincipal } from '../../../../common/security/auth.types';
import { RegisterProviderDto } from '../dto/register-provider.dto';
import { ProviderRegistrationResponse } from '../dto/provider-registration.response';
import { RegisterProviderFromCustomerDto } from '../dto/register-provider-from-customer.dto';
import { ProviderProfileService } from '../../account/services/provider-profile.service';
import { ProviderRegistrationService } from '../services/provider-registration.service';
import type { ProviderAccountResponse } from '../../account/dto/provider-account.response';
import { CustomerJwtAuthGuard } from '../../../customer/authentication/guards/customer-jwt-auth.guard';
import { ProviderAuthorizationService } from '../../authorization/services/provider-authorization.service';

/** Provider onboarding and provider-platform entry-point endpoints. */
@ApiTags('Provider')
@ApiBearerAuth()
@Controller('providers')
@UseGuards(CustomerJwtAuthGuard)
export class ProviderController {
  constructor(
    private readonly providerProfileService: ProviderProfileService,
    private readonly providerRegistrationService: ProviderRegistrationService,
    private readonly providerAuthorizationService: ProviderAuthorizationService,
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
  @Post('register/from-customer')
  registerFromCustomer(
    @CurrentUser() customer: CustomerPrincipal,
    @Body() dto: RegisterProviderFromCustomerDto,
  ): Promise<ProviderRegistrationResponse> {
    return this.providerRegistrationService.requestFromCustomer(
      customer.id,
      dto,
    );
  }

  /** Returns the owned provider account, including pending onboarding state. */
  @Get('me')
  getCurrent(
    @CurrentUser() customer: CustomerPrincipal,
  ): Promise<ProviderAccountResponse> {
    return this.providerProfileService.getCurrent(customer.id);
  }

  /** Returns current provider membership permissions and business state. */
  @Get('me/authorization')
  @ApiOperation({ summary: 'Get current Provider membership authorization' })
  getAuthorization(@CurrentUser() customer: CustomerPrincipal) {
    return this.providerAuthorizationService.effective(customer.id);
  }
}
