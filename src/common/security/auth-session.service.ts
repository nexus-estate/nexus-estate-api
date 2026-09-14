import { createHash, randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { BusinessException } from '../exceptions/business.exception';
import type { BusinessErrorCode } from '../errors/business-error-code';
import { DataSource } from 'typeorm';

export type AuthRealm = 'customer' | 'administration';

type SessionInput = {
  realm: AuthRealm;
  accountId: string;
  refreshToken: string;
  expiresAt: Date;
  absoluteExpiresAt: Date;
  userAgent?: string | null;
  sessionId?: string;
  familyId?: string;
};

type RotationInput = Omit<
  SessionInput,
  'absoluteExpiresAt' | 'sessionId' | 'familyId'
> & {
  sessionId: string;
  familyId: string;
  replacementSessionId: string;
  replacementRefreshToken: string;
  refreshTokenInvalidError: BusinessErrorCode;
  refreshTokenReusedError: BusinessErrorCode;
};

type RotationOutcome =
  | 'NOT_FOUND'
  | 'TOKEN_HASH_MISMATCH'
  | 'ALREADY_ROTATED'
  | 'REVOKED'
  | 'EXPIRED'
  | 'ABSOLUTE_EXPIRED'
  | 'VALID';

/**
 * Canonical PostgreSQL-backed refresh-session lifecycle for customer and
 * administration realms. Authentication services use this boundary after
 * signing a token pair so refresh tokens are never stored in plaintext and
 * refresh rotation can be serialized with row locks. It owns session-family
 * creation, rotation, reuse detection, logout revocation, and account-wide
 * revocation; it does not authenticate credentials or decide API permissions.
 */
@Injectable()
export class AuthSessionService {
  constructor(private readonly dataSource: DataSource) {}

  /** Persists only a hash of a refresh token and starts its realm-scoped session family. */
  async create(input: SessionInput): Promise<{
    sessionId: string;
    familyId: string;
  }> {
    const sessionId = input.sessionId ?? randomUUID();
    const familyId = input.familyId ?? randomUUID();
    await this.dataSource.query(
      `INSERT INTO tbl_auth_session
       (session_id, account_id, realm, family_id, refresh_token_hash, expires_at,
        absolute_expires_at, user_agent)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        sessionId,
        input.accountId,
        input.realm,
        familyId,
        hashToken(input.refreshToken),
        input.expiresAt,
        input.absoluteExpiresAt,
        input.userAgent ?? null,
      ],
    );
    return { sessionId, familyId };
  }

  /**
   * Atomically consumes one refresh token, creates its replacement, and detects reuse.
   *
   * Reuse is returned from the transaction first so the family revocation commits.
   * The public error is deliberately raised only after the transaction resolves.
   */
  async rotate(input: RotationInput): Promise<void> {
    const outcome = await this.dataSource.transaction<RotationOutcome>(
      async (manager) => {
        const rows = await manager.query<SessionRow[]>(
          `SELECT session_id, account_id, realm, family_id, refresh_token_hash,
                expires_at, absolute_expires_at, revoked_at, revoke_reason,
                replaced_by_session_id
         FROM tbl_auth_session
         WHERE session_id = $1 AND account_id = $2 AND realm = $3
         FOR UPDATE`,
          [input.sessionId, input.accountId, input.realm],
        );
        const current = rows[0];
        const now = Date.now();
        let outcome: RotationOutcome = 'NOT_FOUND';

        if (current && current.family_id === input.familyId) {
          if (current.refresh_token_hash !== hashToken(input.refreshToken)) {
            outcome = 'TOKEN_HASH_MISMATCH';
          } else if (
            current.replaced_by_session_id ||
            current.revoke_reason === 'rotated'
          ) {
            outcome = 'ALREADY_ROTATED';
          } else if (current.revoked_at) {
            outcome = 'REVOKED';
          } else if (new Date(current.absolute_expires_at).getTime() <= now) {
            outcome = 'ABSOLUTE_EXPIRED';
          } else if (new Date(current.expires_at).getTime() <= now) {
            outcome = 'EXPIRED';
          } else {
            outcome = 'VALID';
          }
        }

        if (
          outcome === 'TOKEN_HASH_MISMATCH' ||
          outcome === 'ALREADY_ROTATED'
        ) {
          // Use the locked row's identity, never caller-supplied family data, so a
          // malformed token cannot revoke an unrelated account or realm family.
          await manager.query(
            `UPDATE tbl_auth_session
           SET revoked_at = COALESCE(revoked_at, CURRENT_TIMESTAMP),
               revoke_reason = COALESCE(revoke_reason, 'refresh_reuse')
           WHERE family_id = $1 AND realm = $2 AND account_id = $3`,
            [current.family_id, current.realm, current.account_id],
          );
        }

        if (outcome !== 'VALID') return outcome;

        const replacementId = input.replacementSessionId;
        const absoluteExpiresAt = new Date(
          Math.min(
            new Date(current.absolute_expires_at).getTime(),
            new Date(input.expiresAt).getTime(),
          ),
        );
        await manager.query(
          `UPDATE tbl_auth_session
         SET revoked_at = CURRENT_TIMESTAMP, last_used_at = CURRENT_TIMESTAMP,
             revoke_reason = 'rotated', replaced_by_session_id = $2
         WHERE session_id = $1`,
          [input.sessionId, replacementId],
        );
        await manager.query(
          `INSERT INTO tbl_auth_session
         (session_id, account_id, realm, family_id, refresh_token_hash, expires_at,
          absolute_expires_at, user_agent)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [
            replacementId,
            input.accountId,
            input.realm,
            input.familyId,
            hashToken(input.replacementRefreshToken),
            absoluteExpiresAt,
            absoluteExpiresAt,
            input.userAgent ?? null,
          ],
        );
        return outcome;
      },
    );

    if (outcome === 'TOKEN_HASH_MISMATCH' || outcome === 'ALREADY_ROTATED') {
      throw new BusinessException(input.refreshTokenReusedError);
    }
    if (outcome !== 'VALID') {
      throw new BusinessException(input.refreshTokenInvalidError);
    }
  }

  /** Revokes one exact refresh session, typically for logout. */
  async revoke(
    realm: AuthRealm,
    accountId: string,
    sessionId: string,
  ): Promise<void> {
    await this.dataSource.query(
      `UPDATE tbl_auth_session
       SET revoked_at = COALESCE(revoked_at, CURRENT_TIMESTAMP),
           revoke_reason = COALESCE(revoke_reason, 'logout')
       WHERE session_id = $1 AND account_id = $2 AND realm = $3`,
      [sessionId, accountId, realm],
    );
  }

  /** Revokes all active sessions for an account after disable/reset security events. */
  async revokeAccount(
    realm: AuthRealm,
    accountId: string,
    reason: string,
  ): Promise<void> {
    await this.dataSource.query(
      `UPDATE tbl_auth_session SET revoked_at = COALESCE(revoked_at, CURRENT_TIMESTAMP),
       revoke_reason = COALESCE(revoke_reason, $3)
       WHERE account_id = $1 AND realm = $2 AND revoked_at IS NULL`,
      [accountId, realm, reason],
    );
  }
}

/** Creates independent session and family identifiers for a newly issued token pair. */
export function newSessionIdentifiers(): {
  sessionId: string;
  familyId: string;
} {
  return { sessionId: randomUUID(), familyId: randomUUID() };
}

function hashToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

type SessionRow = {
  session_id: string;
  account_id: string;
  realm: AuthRealm;
  family_id: string;
  refresh_token_hash: string;
  expires_at: Date;
  absolute_expires_at: Date;
  revoked_at: Date | null;
  revoke_reason: string | null;
  replaced_by_session_id: string | null;
};
