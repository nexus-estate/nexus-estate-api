import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { BusinessException } from '../../../../common/exceptions/business.exception';
import type {
  AdministrationPrincipal,
  JwtPayload,
  TokenPair,
} from '../../../../common/security/auth.types';
import { BcryptService } from '../../../../common/security/bcrypt.service';
import {
  AuthSessionService,
  newSessionIdentifiers,
} from '../../../../common/security/auth-session.service';
import { AdministrationTokenService } from '../../../../common/security/realm-token.service';
import {
  absoluteSessionExpiry,
  assertRefreshTokenContext,
  buildRealmTokenPayloads,
  resolveRefreshExpiry,
} from '../../../../common/security/authentication-mechanics';
import { AdminLoginDto } from '../dto/admin-login.dto';
import { AdministrationErrorCodes } from '../errors/administration-error-codes';
import { AdministrationAccountRepository } from '../repositories/administration-account.repository';
import type { AdministrationAuthenticationAccount } from '../types/administration-account.type';

/**
 * Administration authentication application service. Use it for internal
 * administrator login, refresh rotation, and logout so the administration
 * realm remains isolated from customer credentials and signing keys. It
 * rejects inactive administrators and persists refresh-session state while
 * runtime permissions remain the responsibility of administration guards.
 */
@Injectable()
export class AdministrationAuthenticationService {
  constructor(
    private readonly accountRepository: AdministrationAccountRepository,
    private readonly tokenService: AdministrationTokenService,
    private readonly bcryptService: BcryptService,
    private readonly sessionService: AuthSessionService,
    private readonly configService: ConfigService,
  ) {}

  /** Authenticates an administrator against the administration credential store. */
  async login(dto: AdminLoginDto): Promise<TokenPair> {
    const account = await this.accountRepository.findByEmailForAuthentication(
      dto.email.trim().toLowerCase(),
    );

    if (
      !account ||
      !(await this.bcryptService.compare(dto.password, account.password))
    ) {
      throw new BusinessException(AdministrationErrorCodes.INVALID_CREDENTIALS);
    }
    if (!account.isActive) {
      throw new BusinessException(AdministrationErrorCodes.ACCOUNT_INACTIVE);
    }

    const identifiers = newSessionIdentifiers();
    const tokens = await this.generateTokenPair(
      this.toPrincipal(account),
      identifiers,
    );
    await this.sessionService.create({
      ...identifiers,
      realm: 'administration',
      accountId: account.id,
      refreshToken: tokens.refreshToken,
      expiresAt: this.refreshExpiry(),
      absoluteExpiresAt: absoluteSessionExpiry(),
    });
    await this.accountRepository.updateLastLogin(account.id, new Date());
    return tokens;
  }

  /** Reissues an administration token pair from a valid refresh token. */
  async refresh(refreshToken: string): Promise<TokenPair> {
    let payload: JwtPayload;
    try {
      payload =
        await this.tokenService.verifyRefreshToken<JwtPayload>(refreshToken);
      assertRefreshTokenContext(payload, 'administration');
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
    const identifiers = newSessionIdentifiers();
    const tokens = await this.generateTokenPair(
      this.toPrincipal(account),
      identifiers,
    );
    await this.sessionService.rotate({
      ...identifiers,
      realm: 'administration',
      accountId: account.id,
      sessionId: payload.sessionId,
      familyId: payload.familyId,
      refreshToken,
      replacementSessionId: identifiers.sessionId,
      replacementRefreshToken: tokens.refreshToken,
      expiresAt: this.refreshExpiry(),
      refreshTokenInvalidError: AdministrationErrorCodes.TOKEN_INVALID,
      refreshTokenReusedError: AdministrationErrorCodes.REFRESH_TOKEN_REUSED,
    });
    return tokens;
  }

  async logout(
    administratorId: string,
    refreshToken: string,
  ): Promise<{ loggedOut: true }> {
    try {
      const payload =
        await this.tokenService.verifyRefreshToken<JwtPayload>(refreshToken);
      assertRefreshTokenContext(payload, 'administration');
      if (payload.sub !== administratorId) {
        throw new Error('Invalid administration refresh context');
      }
      await this.sessionService.revoke(
        'administration',
        administratorId,
        payload.sessionId,
      );
      return { loggedOut: true };
    } catch {
      throw new BusinessException(AdministrationErrorCodes.TOKEN_INVALID);
    }
  }

  private async generateTokenPair(
    principal: AdministrationPrincipal,
    identifiers: { sessionId: string; familyId: string },
  ): Promise<TokenPair> {
    const { accessPayload, refreshPayload } = buildRealmTokenPayloads(
      principal.id,
      'administration',
      identifiers,
    );
    return {
      accessToken: await this.tokenService.signAccessToken(accessPayload),
      refreshToken: await this.tokenService.signRefreshToken(refreshPayload),
    };
  }

  private refreshExpiry(): Date {
    return resolveRefreshExpiry(
      this.configService,
      'ADMIN_JWT_REFRESH_EXPIRES_IN',
    );
  }

  private toPrincipal(
    account: AdministrationAuthenticationAccount,
  ): AdministrationPrincipal {
    return {
      id: account.id,
      email: account.email,
      realm: 'administration',
    };
  }
}
