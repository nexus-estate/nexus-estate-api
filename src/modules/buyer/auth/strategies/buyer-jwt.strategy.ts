import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

import { BusinessException } from '../../../../common/exceptions/business.exception';
import type {
  AuthenticatedPrincipal,
  JwtPayload,
} from '../../../../common/security/auth.types';
import { BuyerAccountService } from '../../account/services/buyer-account.service';
import { BuyerAuthErrorCodes } from '../errors/buyer-auth-error-codes';

/** Validates access tokens issued by the buyer authentication boundary. */
@Injectable()
export class BuyerJwtStrategy extends PassportStrategy(Strategy, 'buyer-jwt') {
  constructor(
    private readonly buyerAccountService: BuyerAccountService,
    configService: ConfigService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.getOrThrow<string>('JWT_SECRET'),
    });
  }

  async validate(payload: JwtPayload): Promise<AuthenticatedPrincipal> {
    if (payload.type !== 'access' || payload.aud !== 'buyer') {
      throw new BusinessException(BuyerAuthErrorCodes.TOKEN_INVALID);
    }

    const account = await this.buyerAccountService.findById(payload.sub);
    return {
      id: account.id,
      email: account.email,
      roleId: account.roleId,
      role: account.role.name,
    };
  }
}
