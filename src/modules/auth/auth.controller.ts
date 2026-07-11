import {
  Body,
  Controller,
  Post,
  Get,
  UseGuards,
  Req,
  Logger,
} from '@nestjs/common';
import type { Request } from 'express';
import { AuthService } from './auth.service';
import { LocalAuthGuard } from './guards/local-auth.guard';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RegisterUserDto } from '../user/dto/create-user-dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';

@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(private readonly authService: AuthService) {}

  @Post('signup')
  async signup(@Body() dto: RegisterUserDto) {
    this.logger.log(`Signup attempt: ${dto.email}`);
    return this.authService.handleSignup(dto);
  }

  @UseGuards(LocalAuthGuard)
  @Post('signin')
  async signin(@Req() req: Request) {
    const user = req.user as AuthUser;
    this.logger.log(`Signin attempt: ${user.email}`);
    return this.authService.handleSignin(
      user as unknown as import('../user/entities/user.entity').User,
    );
  }

  @Post('refresh')
  async refresh(@Body() dto: RefreshTokenDto) {
    this.logger.log('Refresh token attempt');
    return this.authService.handleRefreshToken(dto.refreshToken);
  }

  @UseGuards(JwtAuthGuard)
  @Get('profile')
  async profile(@Req() req: Request) {
    const authUser = req.user as AuthUser;
    this.logger.log(`Profile request: ${authUser.email}`);
    return this.authService.handleGetProfile(authUser.id);
  }
}
