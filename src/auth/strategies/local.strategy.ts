import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-local';
import { AuthService } from '../auth.service';
import { User } from '../../user/entities/user.entity';

@Injectable()
export class LocalStrategy extends PassportStrategy(Strategy) {
  constructor(private authService: AuthService) {
    super({
      usernameField: 'email',        // Dùng 'email' thay vì 'username'
      passwordField: 'password',
    });
  }

  /**
   * Passport tự động gọi method này khi @UseGuards(LocalAuthGuard)
   * Dùng AuthService.handleValidateUser() để verify credentials
   */
  async validate(email: string, password: string): Promise<User> {
    const user = await this.authService.handleValidateUser(email, password);

    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    return user;
  }
}