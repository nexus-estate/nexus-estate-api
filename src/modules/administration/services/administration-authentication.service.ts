import { Injectable } from '@nestjs/common';
import { JwtService, type JwtSignOptions } from '@nestjs/jwt';

import { BusinessException } from '../../../common/exceptions/business.exception';
import type {
  AuthenticatedPrincipal,
  JwtPayload,
  TokenPair,
} from '../../../common/security/auth.types';
import { HashHelper } from '../../../utils/helpers/hash.helper';
import { AdminLoginDto } from '../dto/admin-login.dto';
import { AdministrationErrorCodes } from '../errors/administration-error-codes';
import { AdministrationAccountRepository } from '../repositories/administration-account.repository';
import type { AdministrationAuthenticationAccount } from '../types/administration-account.type';

type JwtExpiresIn = JwtSignOptions['expiresIn'];

/** Issues and validates tokens for the internal administration portal only. */
@Injectable()
export class AdministrationAuthenticationService {
  constructor(
    private readonly accountRepository: AdministrationAccountRepository,
    private readonly jwtService: JwtService,
  ) {}

  /** Authenticates an administrator against the administration credential store. */
  async login(dto: AdminLoginDto): Promise<TokenPair> {
    const account = await this.accountRepository.findByEmailForAuthentication(
      dto.email.trim().toLowerCase(),
    );

    if (
      !account ||
      !(await HashHelper.compare(dto.password, account.password))
    ) {
      throw new BusinessException(AdministrationErrorCodes.INVALID_CREDENTIALS);
    }
    if (!account.isActive) {
      throw new BusinessException(AdministrationErrorCodes.ACCOUNT_INACTIVE);
    }

    return this.generateTokenPair(this.toPrincipal(account));
  }

  /** Reissues an administration token pair from a valid refresh token. */
  async refresh(refreshToken: string): Promise<TokenPair> {
    let payload: JwtPayload;
    try {
      payload = await this.jwtService.verifyAsync<JwtPayload>(refreshToken);
      if (payload.type !== 'refresh' || payload.aud !== 'administration') {
        throw new Error('Invalid administration token context');
      }
    } catch {
      throw new BusinessException(AdministrationErrorCodes.TOKEN_INVALID);
    }

    const account = await this.accountRepository.findByIdForAuthentication(
      payload.sub,
    );
    if (!account) {
      throw new BusinessException(
        AdministrationErrorCodes.ACCOUNT_NOT_FOUND,
        payload.sub,
      );
    }
    if (!account.isActive) {
      throw new BusinessException(AdministrationErrorCodes.ACCOUNT_INACTIVE);
    }
    return this.generateTokenPair(this.toPrincipal(account));
  }

  private async generateTokenPair(
    principal: AuthenticatedPrincipal,
  ): Promise<TokenPair> {
    const accessPayload: JwtPayload = {
      sub: principal.id,
      type: 'access',
      aud: 'administration',
    };
    const refreshPayload: JwtPayload = {
      sub: principal.id,
      type: 'refresh',
      aud: 'administration',
    };
    const accessExpiresIn = (process.env.ADMIN_JWT_ACCESS_EXPIRES_IN ??
      process.env.JWT_ACCESS_EXPIRES_IN ??
      '15m') as JwtExpiresIn;
    const refreshExpiresIn = (process.env.ADMIN_JWT_REFRESH_EXPIRES_IN ??
      process.env.JWT_REFRESH_EXPIRES_IN ??
      '7d') as JwtExpiresIn;

    return {
      accessToken: await this.jwtService.signAsync(accessPayload, {
        expiresIn: accessExpiresIn,
      }),
      refreshToken: await this.jwtService.signAsync(refreshPayload, {
        expiresIn: refreshExpiresIn,
      }),
    };
  }

  private toPrincipal(
    account: AdministrationAuthenticationAccount,
  ): AuthenticatedPrincipal {
    return {
      id: account.id,
      email: account.email,
      roleId: account.roleId,
      role: account.role.name,
    };
  }
}
