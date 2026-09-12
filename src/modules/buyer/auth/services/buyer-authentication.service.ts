import { Injectable } from '@nestjs/common';
import { JwtService, type JwtSignOptions } from '@nestjs/jwt';

import { BusinessException } from '../../../../common/exceptions/business.exception';
import type {
  AuthenticatedPrincipal,
  JwtPayload,
  TokenPair,
} from '../../../../common/security/auth.types';
import { HashHelper } from '../../../../utils/helpers/hash.helper';
import { BuyerAccountService } from '../../account/services/buyer-account.service';
import type { BuyerAuthenticationAccount } from '../../account/types/buyer-account.type';
import { LoginDto } from '../dto/login.dto';
import { BuyerAuthErrorCodes } from '../errors/buyer-auth-error-codes';

type JwtExpiresIn = JwtSignOptions['expiresIn'];

/** Issues and validates tokens for the buyer-facing authentication boundary. */
@Injectable()
export class BuyerAuthenticationService {
  constructor(
    private readonly buyerAccountService: BuyerAccountService,
    private readonly jwtService: JwtService,
  ) {}

  /** Authenticates a buyer account and returns a buyer-scoped token pair. */
  async login(dto: LoginDto): Promise<TokenPair> {
    const account = await this.buyerAccountService.findByEmailForAuthentication(
      dto.email,
    );

    if (
      !account ||
      !(await HashHelper.compare(dto.password, account.password))
    ) {
      throw new BusinessException(BuyerAuthErrorCodes.INVALID_CREDENTIALS);
    }

    const tokens = await this.generateTokenPair(this.toPrincipal(account));
    await this.buyerAccountService.updateLastLogin(account.id, new Date());
    return tokens;
  }

  /** Reissues a buyer-scoped token pair from a valid buyer refresh token. */
  async refresh(refreshToken: string): Promise<TokenPair> {
    let payload: JwtPayload;
    try {
      payload = await this.jwtService.verifyAsync<JwtPayload>(refreshToken);
      if (payload.type !== 'refresh' || payload.aud !== 'buyer') {
        throw new Error('Invalid buyer token context');
      }
    } catch {
      throw new BusinessException(BuyerAuthErrorCodes.TOKEN_INVALID);
    }

    const account = await this.buyerAccountService.findById(payload.sub);
    return this.generateTokenPair(this.toPrincipal(account));
  }

  private async generateTokenPair(
    principal: AuthenticatedPrincipal,
  ): Promise<TokenPair> {
    const accessPayload: JwtPayload = {
      sub: principal.id,
      type: 'access',
      aud: 'buyer',
    };
    const refreshPayload: JwtPayload = {
      sub: principal.id,
      type: 'refresh',
      aud: 'buyer',
    };
    const accessExpiresIn = (process.env.JWT_ACCESS_EXPIRES_IN ??
      '15m') as JwtExpiresIn;
    const refreshExpiresIn = (process.env.JWT_REFRESH_EXPIRES_IN ??
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
    account: Pick<
      BuyerAuthenticationAccount,
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
