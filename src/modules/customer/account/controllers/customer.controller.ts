import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { CurrentUser } from '../../../../common/decorators/current-user.decorator';
import { Public } from '../../../../common/decorators/public.decorator';
import type { CustomerPrincipal } from '../../../../common/security/auth.types';
import { CustomerService } from '../services/customer.service';
import { RegisterCustomerDto } from '../../authentication/dto/register-customer.dto';
import type { SafeCustomerAccount } from '../types/customer-account.type';
import { CustomerJwtAuthGuard } from '../../authentication/guards/customer-jwt-auth.guard';
import { CustomerAuthorizationService } from '../../authorization/services/customer-authorization.service';

/** Customer-facing registration and self-service endpoints. */
@Controller('customers')
@ApiTags('Customer')
@ApiBearerAuth()
@UseGuards(CustomerJwtAuthGuard)
export class CustomerController {
  constructor(
    private readonly customerService: CustomerService,
    private readonly authorizationService: CustomerAuthorizationService,
  ) {}

  /** Registers a customer without requiring an existing access token. */
  @Public()
  @Post('register')
  register(@Body() dto: RegisterCustomerDto): Promise<SafeCustomerAccount> {
    return this.customerService.register(dto);
  }

  /** Returns the current authenticated customer profile. */
  @Get('me')
  getCurrent(
    @CurrentUser() customer: CustomerPrincipal,
  ): Promise<SafeCustomerAccount> {
    return this.customerService.getCurrent(customer.id);
  }

  /** Returns only the authenticated customer's Marketplace authorization. */
  @Get('me/authorization')
  @ApiOperation({ summary: 'Get current Marketplace effective permissions' })
  getAuthorization(@CurrentUser() customer: CustomerPrincipal) {
    return this.authorizationService.effective(customer.id);
  }
}
