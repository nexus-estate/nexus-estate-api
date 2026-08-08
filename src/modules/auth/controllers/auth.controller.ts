import type {
  LoginResponse,
  RegisterResponse,
  RefreshTokenResponse,
} from '@nexus-estate/typescript-sdk';
import { Body, Controller, Post, Get, UseGuards, Logger } from '@nestjs/common';
import { AuthService } from '../services/auth.service';
import { LocalAuthGuard } from '../guards/local-auth.guard';
import { RegisterUserDto } from '../../user/dto/create-user-dto';
import { RefreshTokenDto } from '../dto/refresh-token.dto';
import { User } from '../../user/entities/user.entity';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import type { JwtUserPayload } from '../../../utils';

@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(private readonly authService: AuthService) {}

  @Post('register')
  async register(@Body() dto: RegisterUserDto): Promise<RegisterResponse> {
    this.logger.log(`Register attempt: ${dto.email}`);
    return this.authService.handleRegister(dto);
  }

  @UseGuards(LocalAuthGuard)
  @Post('login')
  async login(@CurrentUser() user: User): Promise<LoginResponse> {
    this.logger.log(`Login attempt: ${user.email}`);
    return this.authService.handleLogin(user);
  }

  @Post('refresh')
  async refresh(@Body() dto: RefreshTokenDto): Promise<RefreshTokenResponse> {
    this.logger.log('Refresh token attempt');
    return this.authService.handleRefreshToken(dto.refreshToken);
  }

  @Get('profile')
  async profile(
    @CurrentUser() user: JwtUserPayload,
  ): Promise<import('@nexus-estate/typescript-sdk').User> {
    this.logger.log(`Profile request: ${user.email}`);
    return this.authService.handleGetProfileSdk(user.id);
  }
}
