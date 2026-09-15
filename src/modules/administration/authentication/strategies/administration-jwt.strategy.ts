import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

import { BusinessException } from '../../../../common/exceptions/business.exception';
import type {
  AdministrationPrincipal,
  JwtPayload,
} from '../../../../common/security/auth.types';
import { AdministrationErrorCodes } from '../errors/administration-error-codes';
import { AdministrationAccountRepository } from '../repositories/administration-account.repository';

/** Validates access tokens issued by the administration boundary. */
@Injectable()
export class AdministrationJwtStrategy extends PassportStrategy(
  Strategy,
  'administration-jwt',
) {
  constructor(
    private readonly accountRepository: AdministrationAccountRepository,
    configService: ConfigService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey:
        configService.get<string>('ADMIN_JWT_ACCESS_SECRET') ??
        configService.get<string>(
          'ADMIN_JWT_SECRET',
          'local-administration-access-secret-32',
        ),
    });
  }

  /** Validates administration realm/type claims and rejects inactive administrators. */
  async validate(payload: JwtPayload): Promise<AdministrationPrincipal> {
    if (
      payload.tokenType !== 'access' ||
      payload.realm !== 'administration' ||
      !payload.sessionId
    ) {
      throw new BusinessException(AdministrationErrorCodes.TOKEN_INVALID);
    }

    const account = await this.accountRepository.findByIdForAuthentication(
      payload.sub,
    );
    if (!account) {
      throw new BusinessException(AdministrationErrorCodes.ACCOUNT_NOT_FOUND);
    }
    if (!account.isActive) {
      throw new BusinessException(AdministrationErrorCodes.ACCOUNT_INACTIVE);
    }

    return {
      id: account.id,
      email: account.email,
      realm: 'administration',
    };
  }
}
