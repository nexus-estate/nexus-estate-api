import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';

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
  @Throttle({ default: { limit: 100, ttl: 60_000 } })
  /** Authenticates a customer and starts a persistent refresh session. */
  login(@Body() dto: LoginDto): Promise<TokenPair> {
    return this.authenticationService.login(dto);
  }

  /** Returns the authenticated customer identity. */
  @Get('profile')
  /** Returns the authenticated customer profile. */
  getProfile(
    @CurrentUser() principal: CustomerPrincipal,
  ): Promise<SafeCustomerAccount> {
    return this.customerAccountService.findById(principal.id);
  }

  /** Reissues customer access and refresh tokens. */
  @Public()
  @Post('refresh')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  /** Rotates a valid customer refresh session and issues a new token pair. */
  refresh(@Body() dto: RefreshTokenDto): Promise<TokenPair> {
    return this.authenticationService.refresh(dto.refreshTokenString);
  }

  /** Revokes the refresh session represented by the submitted token. */
  @Post('logout')
  /** Revokes the submitted customer refresh session. */
  logout(
    @CurrentUser() principal: CustomerPrincipal,
    @Body() dto: RefreshTokenDto,
  ): Promise<{ loggedOut: true }> {
    return this.authenticationService.logout(
      principal.id,
      dto.refreshTokenString,
    );
  }
}
