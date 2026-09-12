import { Injectable } from '@nestjs/common';
import { type JwtSignOptions } from '@nestjs/jwt';

import { BusinessException } from '../../../common/exceptions/business.exception';
import type {
  AuthenticatedPrincipal,
  JwtPayload,
  TokenPair,
} from '../../../common/security/auth.types';
import { BcryptService } from '../../../common/security/bcrypt.service';
import { TokenService } from '../../../common/security/token.service';
import { CustomerAccountService } from './customer-account.service';
import type { CustomerAuthenticationAccount } from '../types/customer-account.type';
import { LoginDto } from '../dto/login.dto';
import { CustomerAuthErrorCodes } from '../errors/customer-auth-error-codes';

type JwtExpiresIn = JwtSignOptions['expiresIn'];

/** Issues and validates tokens for the customer-facing authentication boundary. */
@Injectable()
export class CustomerAuthenticationService {
  constructor(
    private readonly customerAccountService: CustomerAccountService,
    private readonly tokenService: TokenService,
    private readonly bcryptService: BcryptService,
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

    const tokens = await this.generateTokenPair(this.toPrincipal(account));
    await this.customerAccountService.updateLastLogin(account.id, new Date());
    return tokens;
  }

  /** Reissues a customer-scoped token pair from a valid customer refresh token. */
  async refresh(refreshToken: string): Promise<TokenPair> {
    let payload: JwtPayload;
    try {
      payload = await this.tokenService.verifyToken<JwtPayload>(refreshToken);
      if (payload.type !== 'refresh' || payload.aud !== 'customer') {
        throw new Error('Invalid customer token context');
      }
    } catch {
      throw new BusinessException(CustomerAuthErrorCodes.TOKEN_INVALID);
    }

    const account = await this.customerAccountService.findById(payload.sub);
    return this.generateTokenPair(this.toPrincipal(account));
  }

  private async generateTokenPair(
    principal: AuthenticatedPrincipal,
  ): Promise<TokenPair> {
    const accessPayload: JwtPayload = {
      sub: principal.id,
      type: 'access',
      aud: 'customer',
    };
    const refreshPayload: JwtPayload = {
      sub: principal.id,
      type: 'refresh',
      aud: 'customer',
    };
    const accessExpiresIn = (process.env.JWT_ACCESS_EXPIRES_IN ??
      '15m') as JwtExpiresIn;
    const refreshExpiresIn = (process.env.JWT_REFRESH_EXPIRES_IN ??
      '7d') as JwtExpiresIn;

    return {
      accessToken: await this.tokenService.signAccessToken(
        accessPayload,
        accessExpiresIn,
      ),
      refreshToken: await this.tokenService.signRefreshToken(
        refreshPayload,
        refreshExpiresIn,
      ),
    };
  }

  private toPrincipal(
    account: Pick<
      CustomerAuthenticationAccount,
      'id' | 'email' | 'roleId' | 'role'
    >,
  ): AuthenticatedPrincipal {
    return {
      id: account.id,
      email: account.email,
      roleId: account.roleId,
      role: account.role.name,
    };
  }
}
