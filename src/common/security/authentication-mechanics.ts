import type { ConfigService } from '@nestjs/config';

import type { AuthenticationContext, JwtPayload } from './auth.types';
import { durationToMilliseconds } from './realm-token.service';

/** Absolute session lifetime shared by every authentication realm. */
export const SESSION_ABSOLUTE_TTL_MS = 30 * 86_400_000;

/** Absolute expiry timestamp for a newly created authentication session. */
export function absoluteSessionExpiry(): Date {
  return new Date(Date.now() + SESSION_ABSOLUTE_TTL_MS);
}

/**
 * Resolves a realm's refresh-token expiry from configuration, falling back to
 * the shared `JWT_REFRESH_EXPIRES_IN` value and then to seven days.
 */
export function resolveRefreshExpiry(
  configService: ConfigService,
  realmEnvKey: string,
): Date {
  const duration = configService.get<string>(
    realmEnvKey,
    configService.get<string>('JWT_REFRESH_EXPIRES_IN', '7d'),
  );
  return new Date(Date.now() + durationToMilliseconds(duration));
}

/** A refresh-token payload narrowed to the claims required for rotation. */
export type RefreshTokenPayload = JwtPayload & {
  tokenType: 'refresh';
  realm: AuthenticationContext;
  sessionId: string;
  familyId: string;
};

/**
 * Validates that a refresh-token payload belongs to the expected realm and
 * carries the session identifiers required for rotation. The thrown error is
 * intentionally realm-neutral; each caller maps it to its own error code.
 */
export function assertRefreshTokenContext(
  payload: JwtPayload,
  realm: AuthenticationContext,
): asserts payload is RefreshTokenPayload {
  if (
    payload.tokenType !== 'refresh' ||
    payload.realm !== realm ||
    !payload.sessionId ||
    !payload.familyId
  ) {
    throw new Error(`Invalid ${realm} token context`);
  }
}

/** Builds the access/refresh JWT payload pair for a realm-signed token pair. */
export function buildRealmTokenPayloads(
  principalId: string,
  realm: AuthenticationContext,
  identifiers: { sessionId: string; familyId: string },
): { accessPayload: JwtPayload; refreshPayload: JwtPayload } {
  const base: JwtPayload = {
    sub: principalId,
    realm,
    sessionId: identifiers.sessionId,
    familyId: identifiers.familyId,
  };
  return { accessPayload: { ...base }, refreshPayload: { ...base } };
}
