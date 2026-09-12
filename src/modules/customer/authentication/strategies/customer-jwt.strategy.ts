import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

import { BusinessException } from '../../../../common/exceptions/business.exception';
import type {
  CustomerPrincipal,
  JwtPayload,
} from '../../../../common/security/auth.types';
import { CustomerAccountService } from '../../account/services/customer-account.service';
import { CustomerAuthErrorCodes } from '../errors/customer-auth-error-codes';

/** Validates access tokens issued by the customer authentication boundary. */
@Injectable()
export class CustomerJwtStrategy extends PassportStrategy(
  Strategy,
  'customer-jwt',
) {
  constructor(
    private readonly customerAccountService: CustomerAccountService,
    configService: ConfigService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.getOrThrow<string>('JWT_SECRET'),
    });
  }

  async validate(payload: JwtPayload): Promise<CustomerPrincipal> {
    if (payload.type !== 'access' || payload.aud !== 'customer') {
      throw new BusinessException(CustomerAuthErrorCodes.TOKEN_INVALID);
    }

    const account = await this.customerAccountService.findById(payload.sub);
    return {
      id: account.id,
      email: account.email,
      realm: 'customer',
    };
  }
}
