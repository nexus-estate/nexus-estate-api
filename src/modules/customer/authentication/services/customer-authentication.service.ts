import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { BusinessException } from '../../../../common/exceptions/business.exception';
import type {
  CustomerPrincipal,
  JwtPayload,
  TokenPair,
} from '../../../../common/security/auth.types';
import { BcryptService } from '../../../../common/security/bcrypt.service';
import {
  AuthSessionService,
  newSessionIdentifiers,
} from '../../../../common/security/auth-session.service';
import {
  CustomerTokenService,
  durationToMilliseconds,
} from '../../../../common/security/realm-token.service';
import { CustomerAccountService } from '../../account/services/customer-account.service';
import type { CustomerAuthenticationAccount } from '../../account/types/customer-account.type';
import { LoginDto } from '../dto/login.dto';
import { CustomerAuthErrorCodes } from '../errors/customer-auth-error-codes';

/**
 * Customer authentication application service. Use it for credential login,
 * rotating customer refresh sessions, and logout; controllers should not sign
 * JWTs or access the session table directly. It issues customer-realm access
 * and refresh tokens with separate keys, persists only refresh-token hashes,
 * and leaves authorization decisions to the current database-backed guards.
 */
@Injectable()
export class CustomerAuthenticationService {
  constructor(
    private readonly customerAccountService: CustomerAccountService,
    private readonly tokenService: CustomerTokenService,
    private readonly bcryptService: BcryptService,
    private readonly sessionService: AuthSessionService,
    private readonly configService: ConfigService,
  ) {}

  /** Authenticates a customer account and returns a customer-scoped token pair. */
  async login(dto: LoginDto): Promise<TokenPair> {
    const account =
      await this.customerAccountService.findByEmailForAuthentication(dto.email);

    if (
      !account ||
      !(await this.bcryptService.compare(dto.password, account.password))
    ) {
      throw new BusinessException(CustomerAuthErrorCodes.INVALID_CREDENTIALS);
    }

    const identifiers = newSessionIdentifiers();
    const tokens = await this.generateTokenPair(
      this.toPrincipal(account),
      identifiers,
    );
    await this.sessionService.create({
      ...identifiers,
      realm: 'customer',
      accountId: account.id,
      refreshToken: tokens.refreshToken,
      expiresAt: this.refreshExpiry(),
      absoluteExpiresAt: new Date(Date.now() + 30 * 86_400_000),
    });
    await this.customerAccountService.updateLastLogin(account.id, new Date());
    return tokens;
  }

  /** Reissues a customer-scoped token pair from a valid customer refresh token. */
  async refresh(refreshToken: string): Promise<TokenPair> {
    let payload: JwtPayload;
    try {
      payload =
        await this.tokenService.verifyRefreshToken<JwtPayload>(refreshToken);
      if (
        payload.tokenType !== 'refresh' ||
        payload.realm !== 'customer' ||
        !payload.sessionId ||
        !payload.familyId
      ) {
        throw new Error('Invalid customer token context');
      }
    } catch {
      throw new BusinessException(CustomerAuthErrorCodes.TOKEN_INVALID);
    }

    const account = await this.customerAccountService.findById(payload.sub);
    const identifiers = newSessionIdentifiers();
    const tokens = await this.generateTokenPair(
      this.toPrincipal(account),
      identifiers,
    );
    await this.sessionService.rotate({
      ...identifiers,
      realm: 'customer',
      accountId: account.id,
      sessionId: payload.sessionId,
      familyId: payload.familyId,
      refreshToken,
      replacementSessionId: identifiers.sessionId,
      replacementRefreshToken: tokens.refreshToken,
      expiresAt: this.refreshExpiry(),
      refreshTokenInvalidError: CustomerAuthErrorCodes.TOKEN_INVALID,
      refreshTokenReusedError: CustomerAuthErrorCodes.REFRESH_TOKEN_REUSED,
    });
    return tokens;
  }

  async logout(
    customerId: string,
    refreshToken: string,
  ): Promise<{ loggedOut: true }> {
    try {
      const payload =
        await this.tokenService.verifyRefreshToken<JwtPayload>(refreshToken);
      if (
        payload.realm !== 'customer' ||
        payload.tokenType !== 'refresh' ||
        payload.sub !== customerId ||
        !payload.sessionId
      ) {
        throw new Error('Invalid customer refresh context');
      }
      await this.sessionService.revoke(
        'customer',
        customerId,
        payload.sessionId,
      );
      return { loggedOut: true };
    } catch {
      throw new BusinessException(CustomerAuthErrorCodes.TOKEN_INVALID);
    }
  }

  private async generateTokenPair(
    principal: CustomerPrincipal,
    identifiers: { sessionId: string; familyId: string },
  ): Promise<TokenPair> {
    const accessPayload: JwtPayload = {
      sub: principal.id,
      realm: 'customer',
      sessionId: identifiers.sessionId,
      familyId: identifiers.familyId,
    };
    const refreshPayload: JwtPayload = {
      sub: principal.id,
      realm: 'customer',
      sessionId: identifiers.sessionId,
      familyId: identifiers.familyId,
    };

    return {
      accessToken: await this.tokenService.signAccessToken(accessPayload),
      refreshToken: await this.tokenService.signRefreshToken(refreshPayload),
    };
  }

  private refreshExpiry(): Date {
    const duration = this.configService.get<string>(
      'CUSTOMER_JWT_REFRESH_EXPIRES_IN',
      this.configService.get<string>('JWT_REFRESH_EXPIRES_IN', '7d'),
    );
    return new Date(Date.now() + durationToMilliseconds(duration));
  }

  private toPrincipal(
    account: Pick<CustomerAuthenticationAccount, 'id' | 'email'>,
  ): CustomerPrincipal {
    return {
      id: account.id,
      email: account.email,
      realm: 'customer',
    };
  }
}
