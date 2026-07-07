import { Body, Controller, Post, UseGuards, Request, Logger } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LocalAuthGuard } from './guards/local-auth.guard';
import { RegisterUserDto } from '../user/dto/create-user-dto';
import { User } from '../user/entities/user.entity';

@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(private authService: AuthService) {}

  /**
   * POST /auth/signup
   * Đăng ký user mới (public - không cần guard)
   */
  @Post('signup')
  async handleSignup(@Body() registerUserDto: RegisterUserDto) {
    this.logger.log(`Signup attempt: ${registerUserDto.email}`);
    return this.authService.handleSignup(registerUserDto);
  }

  /**
   * POST /auth/signin
   * Đăng nhập (LocalAuthGuard xác thực email/password trước)
   * req.user được set bởi LocalStrategy.validate()
   */
  @UseGuards(LocalAuthGuard)
  @Post('signin')
  async handleSignin(@Request() req: { user: User }) {
    this.logger.log(`Signin attempt: ${req.user.email}`);
    return this.authService.handleSignin(req.user);
  }
}