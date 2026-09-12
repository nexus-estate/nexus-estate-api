import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';

import { CurrentUser } from '../../../../common/decorators/current-user.decorator';
import { Public } from '../../../../common/decorators/public.decorator';
import type {
  AuthenticatedPrincipal,
  TokenPair,
} from '../../../../common/security/auth.types';
import { BuyerAccountService } from '../../account/services/buyer-account.service';
import type { SafeBuyerAccount } from '../../account/types/buyer-account.type';
import { LoginDto } from '../dto/login.dto';
import { RefreshTokenDto } from '../dto/refresh-token.dto';
import { BuyerAuthenticationService } from '../services/buyer-authentication.service';
import { BuyerJwtAuthGuard } from '../guards/buyer-jwt-auth.guard';

/** Buyer authentication endpoints; administration has an independent boundary. */
@Controller('buyers/auth')
@UseGuards(BuyerJwtAuthGuard)
export class BuyerAuthenticationController {
  constructor(
    private readonly authenticationService: BuyerAuthenticationService,
    private readonly buyerAccountService: BuyerAccountService,
  ) {}

  /** Authenticates a buyer account. */
  @Public()
  @Post('login')
  login(@Body() dto: LoginDto): Promise<TokenPair> {
    return this.authenticationService.login(dto);
  }

  /** Returns the authenticated buyer identity. */
  @Get('profile')
  getProfile(
    @CurrentUser() principal: AuthenticatedPrincipal,
  ): Promise<SafeBuyerAccount> {
    return this.buyerAccountService.findById(principal.id);
  }

  /** Reissues buyer access and refresh tokens. */
  @Public()
  @Post('refresh')
  refresh(@Body() dto: RefreshTokenDto): Promise<TokenPair> {
    return this.authenticationService.refresh(dto.refreshTokenString);
  }
}
