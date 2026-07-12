import { Injectable, Logger } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { UserService } from '../../user/services/user.service';
import type { JwtUserPayload } from '../../../utils/helpers/jwt.helper';

interface JwtStrategyPayload {
  sub: string;
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

  async validate(payload: JwtStrategyPayload): Promise<JwtUserPayload> {
    const user = await this.userService.findOne(payload.sub);
    return {
      id: user.id,
      email: user.email,
      roleId: user.roleId,
      role: user.role?.name || 'unknown',
    };
  }
}
