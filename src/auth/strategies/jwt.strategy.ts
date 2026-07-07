import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { UserService } from '../../user/user.service';
import { User } from '../../user/entities/user.entity';

interface JwtPayload {
  sub: string; // userId
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  private readonly logger = new Logger(JwtStrategy.name);

  constructor(private readonly userService: UserService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET || 'fallback-secret',
    });
  }

  /**
   * Passport tự động gọi method này khi request có @UseGuards(JwtAuthGuard).
   * Validate user từ JWT payload, ném UnauthorizedException nếu không tìm thấy.
   */
  async validate(payload: JwtPayload): Promise<User> {
    const user = await this.userService.handleFindOne(payload.sub);

    if (!user) {
      this.logger.warn(`User not found for token payload sub: ${payload.sub}`);
      throw new UnauthorizedException('User not found');
    }

    return user;
  }
}