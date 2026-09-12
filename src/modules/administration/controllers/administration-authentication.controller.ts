import { Body, Controller, Post } from '@nestjs/common';

import { Public } from '../../../common/decorators/public.decorator';
import type { TokenPair } from '../../../common/security/auth.types';
import { AdminLoginDto } from '../dto/admin-login.dto';
import { AdminRefreshTokenDto } from '../dto/admin-refresh-token.dto';
import { AdministrationAuthenticationService } from '../services/administration-authentication.service';

/** Authentication endpoints for the internal administration portal. */
@Controller('administration/auth')
export class AdministrationAuthenticationController {
  constructor(
    private readonly authenticationService: AdministrationAuthenticationService,
  ) {}

  /** Authenticates an administrator against the dedicated credential store. */
  @Public()
  @Post('login')
  login(@Body() dto: AdminLoginDto): Promise<TokenPair> {
    return this.authenticationService.login(dto);
  }

  /** Reissues administration access and refresh tokens. */
  @Public()
  @Post('refresh')
  refresh(@Body() dto: AdminRefreshTokenDto): Promise<TokenPair> {
    return this.authenticationService.refresh(dto.refreshToken);
  }
}
