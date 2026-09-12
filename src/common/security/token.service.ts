import { Injectable } from '@nestjs/common';
import { JwtService, type JwtSignOptions } from '@nestjs/jwt';

import type { JwtPayload } from './auth.types';

/**
 * Provides the common token operations used by authentication boundaries.
 * Each boundary supplies its own configured JwtService, so secrets remain
 * isolated while login and refresh logic use one stable application API.
 */
@Injectable()
export class TokenService {
  constructor(private readonly jwtService: JwtService) {}

  /** Signs a short-lived access token for an authenticated principal. */
  signAccessToken(
    payload: JwtPayload,
    expiresIn: JwtSignOptions['expiresIn'],
  ): Promise<string> {
    return this.jwtService.signAsync(payload, { expiresIn });
  }

  /** Signs a long-lived refresh token for an authenticated principal. */
  signRefreshToken(
    payload: JwtPayload,
    expiresIn: JwtSignOptions['expiresIn'],
  ): Promise<string> {
    return this.jwtService.signAsync(payload, { expiresIn });
  }

  /** Verifies and decodes a token using the boundary-specific JWT secret. */
  verifyToken<T extends object>(token: string): Promise<T> {
    return this.jwtService.verifyAsync<T>(token);
  }
}
