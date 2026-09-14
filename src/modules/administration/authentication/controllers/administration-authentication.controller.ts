import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';

import { CurrentUser } from '../../../../common/decorators/current-user.decorator';
import { Public } from '../../../../common/decorators/public.decorator';
import type {
  AdministrationPrincipal,
  TokenPair,
} from '../../../../common/security/auth.types';
import { AdministrationJwtAuthGuard } from '../guards/administration-jwt-auth.guard';
import { AdminLoginDto } from '../dto/admin-login.dto';
import { AdminRefreshTokenDto } from '../dto/admin-refresh-token.dto';
import { AdministrationAuthenticationService } from '../services/administration-authentication.service';

/** Authentication endpoints for the internal administration portal. */
@Controller('administration/auth')
@UseGuards(AdministrationJwtAuthGuard)
export class AdministrationAuthenticationController {
  constructor(
    private readonly authenticationService: AdministrationAuthenticationService,
  ) {}

  /** Authenticates an administrator against the dedicated credential store. */
  @Public()
  @Post('login')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  /** Authenticates an active administrator and starts a refresh session. */
  login(@Body() dto: AdminLoginDto): Promise<TokenPair> {
    return this.authenticationService.login(dto);
  }

  /** Reissues administration access and refresh tokens. */
  @Public()
  @Post('refresh')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  /** Rotates a valid administration refresh session. */
  refresh(@Body() dto: AdminRefreshTokenDto): Promise<TokenPair> {
    return this.authenticationService.refresh(dto.refreshToken);
  }

  /** Revokes the refresh session represented by the submitted token. */
  @Post('logout')
  /** Revokes the submitted administration refresh session. */
  logout(
    @CurrentUser() principal: AdministrationPrincipal,
    @Body() dto: AdminRefreshTokenDto,
  ): Promise<{ loggedOut: true }> {
    return this.authenticationService.logout(principal.id, dto.refreshToken);
  }
}
