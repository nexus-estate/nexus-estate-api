import type { ConfigService } from '@nestjs/config';

import {
  absoluteSessionExpiry,
  assertRefreshTokenContext,
  buildRealmTokenPayloads,
  resolveRefreshExpiry,
  SESSION_ABSOLUTE_TTL_MS,
} from './authentication-mechanics';
import type { JwtPayload } from './auth.types';

describe('authentication mechanics', () => {
  describe('absoluteSessionExpiry', () => {
    it('returns the shared absolute session lifetime from now', () => {
      const before = Date.now();
      const expiry = absoluteSessionExpiry();
      const after = Date.now();

      expect(expiry.getTime()).toBeGreaterThanOrEqual(
        before + SESSION_ABSOLUTE_TTL_MS,
      );
      expect(expiry.getTime()).toBeLessThanOrEqual(
        after + SESSION_ABSOLUTE_TTL_MS,
      );
    });
  });

  describe('resolveRefreshExpiry', () => {
    const configService = (values: Record<string, string | undefined>) =>
      ({
        get: (key: string, fallback?: string) => values[key] ?? fallback,
      }) as unknown as ConfigService;

    it('prefers the realm-specific key', () => {
      const expiry = resolveRefreshExpiry(
        configService({
          CUSTOMER_JWT_REFRESH_EXPIRES_IN: '1h',
          JWT_REFRESH_EXPIRES_IN: '7d',
        }),
        'CUSTOMER_JWT_REFRESH_EXPIRES_IN',
      );

      expect(expiry.getTime()).toBeLessThanOrEqual(Date.now() + 3_600_000 + 50);
    });

    it('falls back to the shared key and then the default', () => {
      const shared = resolveRefreshExpiry(
        configService({ JWT_REFRESH_EXPIRES_IN: '2h' }),
        'ADMIN_JWT_REFRESH_EXPIRES_IN',
      );
      expect(shared.getTime()).toBeLessThanOrEqual(Date.now() + 7_200_000 + 50);

      const fallback = resolveRefreshExpiry(
        configService({}),
        'ADMIN_JWT_REFRESH_EXPIRES_IN',
      );
      expect(fallback.getTime()).toBeGreaterThan(Date.now() + 6 * 86_400_000);
    });
  });

  describe('assertRefreshTokenContext', () => {
    const valid = (): JwtPayload => ({
      sub: 'account-1',
      realm: 'customer',
      tokenType: 'refresh',
      sessionId: 'session-1',
      familyId: 'family-1',
    });

    it('accepts a matching refresh payload and narrows its session claims', () => {
      const payload = valid();
      assertRefreshTokenContext(payload, 'customer');
      expect(payload.sessionId).toBe('session-1');
      expect(payload.familyId).toBe('family-1');
    });

    it.each([
      ['wrong realm', { ...valid(), realm: 'administration' as const }],
      ['access token', { ...valid(), tokenType: 'access' as const }],
      ['missing session', { ...valid(), sessionId: undefined }],
      ['missing family', { ...valid(), familyId: undefined }],
    ])('rejects %s', (_label, payload) => {
      expect(() => assertRefreshTokenContext(payload, 'customer')).toThrow();
    });
  });

  describe('buildRealmTokenPayloads', () => {
    it('builds access and refresh payloads with the realm and session claims', () => {
      const { accessPayload, refreshPayload } = buildRealmTokenPayloads(
        'account-1',
        'administration',
        { sessionId: 'session-1', familyId: 'family-1' },
      );

      expect(accessPayload).toEqual({
        sub: 'account-1',
        realm: 'administration',
        sessionId: 'session-1',
        familyId: 'family-1',
      });
      expect(refreshPayload).toEqual(accessPayload);
      expect(refreshPayload).not.toBe(accessPayload);
    });
  });
});
