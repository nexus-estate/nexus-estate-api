import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';

import { LocalAuthGuard } from '../guard/local-auth.guard';
import { AuthService } from '../services/auth.service';
import type { AuthenticatedPrincipal, TokenPair } from '../types/auth.type';
import { Public } from '../../../common/decorators/public.decorator';
import type { SafeUser } from '../../user/types/user.type';
import { RegisterDto } from '../dto/register.dto';
import { RefreshTokenDto } from '../dto/refresh-token-dto';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';

type AuthenticatedRequest = Request & {
  user: AuthenticatedPrincipal;
};

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @UseGuards(LocalAuthGuard)
  @Post('login')
  async login(@Req() request: AuthenticatedRequest): Promise<TokenPair> {
    return this.authService.handleLogin(request.user);
  }

  @Get('profile')
  getProfile(
    @CurrentUser() user: AuthenticatedPrincipal,
  ): AuthenticatedPrincipal {
    return user;
  }

  @Public()
  @Post('register')
  async register(@Body() dto: RegisterDto): Promise<SafeUser> {
    return this.authService.handleRegister(dto);
  }

  @Public()
  @Post('refresh')
  async refreshToken(@Body() dto: RefreshTokenDto): Promise<TokenPair> {
    return this.authService.handleRefreshToken(dto.refreshTokenString);
  }
}
