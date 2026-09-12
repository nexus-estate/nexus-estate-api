import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';

import { CurrentUser } from '../../../../common/decorators/current-user.decorator';
import { Public } from '../../../../common/decorators/public.decorator';
import type {
  CustomerPrincipal,
  TokenPair,
} from '../../../../common/security/auth.types';
import { CustomerAccountService } from '../../account/services/customer-account.service';
import type { SafeCustomerAccount } from '../../account/types/customer-account.type';
import { LoginDto } from '../dto/login.dto';
import { RefreshTokenDto } from '../dto/refresh-token.dto';
import { CustomerAuthenticationService } from '../services/customer-authentication.service';
import { CustomerJwtAuthGuard } from '../guards/customer-jwt-auth.guard';

/** Customer authentication endpoints; administration has an independent boundary. */
@Controller('customers/auth')
@UseGuards(CustomerJwtAuthGuard)
export class CustomerAuthenticationController {
  constructor(
    private readonly authenticationService: CustomerAuthenticationService,
    private readonly customerAccountService: CustomerAccountService,
  ) {}

  /** Authenticates a customer account. */
  @Public()
  @Post('login')
  login(@Body() dto: LoginDto): Promise<TokenPair> {
    return this.authenticationService.login(dto);
  }

  /** Returns the authenticated customer identity. */
  @Get('profile')
  getProfile(
    @CurrentUser() principal: CustomerPrincipal,
  ): Promise<SafeCustomerAccount> {
    return this.customerAccountService.findById(principal.id);
  }

  /** Reissues customer access and refresh tokens. */
  @Public()
  @Post('refresh')
  refresh(@Body() dto: RefreshTokenDto): Promise<TokenPair> {
    return this.authenticationService.refresh(dto.refreshTokenString);
  }
}
