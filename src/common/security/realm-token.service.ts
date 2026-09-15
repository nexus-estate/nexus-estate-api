import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService, type JwtSignOptions } from '@nestjs/jwt';
import type { AuthenticationContext, JwtPayload } from './auth.types';

type RealmTokenConfig = {
  realm: AuthenticationContext;
  accessSecret: string;
  refreshSecret: string;
  accessExpiresIn: JwtSignOptions['expiresIn'];
  refreshExpiresIn: JwtSignOptions['expiresIn'];
};

/** Small common JWT primitive with explicit access/refresh key selection. */
export class RealmTokenService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly config: RealmTokenConfig,
  ) {}

  /** Signs an access token with this realm's access key and explicit token type. */
  signAccessToken(payload: JwtPayload): Promise<string> {
    return this.jwtService.signAsync(
      { ...payload, realm: this.config.realm, tokenType: 'access' },
      {
        secret: this.config.accessSecret,
        expiresIn: this.config.accessExpiresIn,
      },
    );
  }

  /** Signs a refresh token with the separate refresh key for this realm. */
  signRefreshToken(payload: JwtPayload): Promise<string> {
    return this.jwtService.signAsync(
      { ...payload, realm: this.config.realm, tokenType: 'refresh' },
      {
        secret: this.config.refreshSecret,
        expiresIn: this.config.refreshExpiresIn,
      },
    );
  }

  /** Verifies signature and expiry using only this realm's access key. */
  verifyAccessToken<T extends JwtPayload>(token: string): Promise<T> {
    return this.jwtService.verifyAsync<T>(token, {
      secret: this.config.accessSecret,
    });
  }

  /** Verifies signature and expiry using only this realm's refresh key. */
  verifyRefreshToken<T extends JwtPayload>(token: string): Promise<T> {
    return this.jwtService.verifyAsync<T>(token, {
      secret: this.config.refreshSecret,
    });
  }
}

/** Converts the validated compact duration format to milliseconds. */
/** Converts the validated compact JWT duration syntax into milliseconds for session expiry. */
export function durationToMilliseconds(value: string): number {
  const match = /^(\d+)(ms|s|m|h|d|w)$/.exec(value);
  if (!match) throw new Error(`Invalid duration: ${value}`);
  const amount = Number(match[1]);
  const units: Record<string, number> = {
    ms: 1,
    s: 1_000,
    m: 60_000,
    h: 3_600_000,
    d: 86_400_000,
    w: 604_800_000,
  };
  return amount * units[match[2]];
}

/** Customer-only signer; its keys are never sourced from administration config. */
@Injectable()
export class CustomerTokenService extends RealmTokenService {
  constructor(jwtService: JwtService, configService: ConfigService) {
    super(jwtService, {
      realm: 'customer',
      accessSecret:
        configService.get<string>('CUSTOMER_JWT_ACCESS_SECRET') ??
        configService.getOrThrow<string>('JWT_SECRET'),
      refreshSecret:
        configService.get<string>('CUSTOMER_JWT_REFRESH_SECRET') ??
        configService.get<string>(
          'JWT_REFRESH_SECRET',
          'local-customer-refresh-secret-change-me-32',
        ),
      accessExpiresIn: configService.get<string>(
        'CUSTOMER_JWT_ACCESS_EXPIRES_IN',
        '15m',
      ) as JwtSignOptions['expiresIn'],
      refreshExpiresIn: configService.get<string>(
        'CUSTOMER_JWT_REFRESH_EXPIRES_IN',
        '7d',
      ) as JwtSignOptions['expiresIn'],
    });
  }
}

/** Administration-only signer; its keys are never sourced from customer config. */
@Injectable()
export class AdministrationTokenService extends RealmTokenService {
  constructor(jwtService: JwtService, configService: ConfigService) {
    super(jwtService, {
      realm: 'administration',
      accessSecret:
        configService.get<string>('ADMIN_JWT_ACCESS_SECRET') ??
        configService.get<string>(
          'ADMIN_JWT_SECRET',
          'local-administration-access-secret-32',
        ),
      refreshSecret: configService.get<string>(
        'ADMIN_JWT_REFRESH_SECRET',
        'local-administration-refresh-secret-32',
      ),
      accessExpiresIn: configService.get<string>(
        'ADMIN_JWT_ACCESS_EXPIRES_IN',
        '15m',
      ) as JwtSignOptions['expiresIn'],
      refreshExpiresIn: configService.get<string>(
        'ADMIN_JWT_REFRESH_EXPIRES_IN',
        '7d',
      ) as JwtSignOptions['expiresIn'],
    });
  }
}
