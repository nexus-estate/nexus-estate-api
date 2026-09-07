import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

import { UserService } from '../../user/service/user.service';
import { AuthenticatedPrincipal, JwtPayload } from '../types/auth.type';
import { BusinessException } from '../../../common/exceptions/business.exception';
import { ErrorCodes } from '../../../utils';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly userService: UserService,
    configService: ConfigService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.getOrThrow<string>('JWT_SECRET'),
    });
  }
  async validate(payload: JwtPayload): Promise<AuthenticatedPrincipal> {
    if (payload.type !== 'access') {
      throw new BusinessException(ErrorCodes.TOKEN_INVALID);
    }
    const user = await this.userService.findById(payload.sub);

    return {
      id: user.id,
      email: user.email,
      roleId: user.roleId,
      role: user.role.name,
    };
  }
}
