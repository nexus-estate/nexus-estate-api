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
      secretOrKey:
        configService.get<string>('CUSTOMER_JWT_ACCESS_SECRET') ??
        configService.getOrThrow<string>('JWT_SECRET'),
    });
  }

  /** Validates customer realm/type claims and resolves the current account from the database. */
  async validate(payload: JwtPayload): Promise<CustomerPrincipal> {
    if (
      payload.tokenType !== 'access' ||
      payload.realm !== 'customer' ||
      !payload.sessionId
    ) {
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
