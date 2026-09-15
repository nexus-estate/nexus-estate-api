import { Column, Entity, Index, PrimaryColumn } from 'typeorm';

/** Technical refresh-session projection used for local synchronized test schemas. */
@Entity('tbl_auth_session')
@Index('idx_auth_session_account_realm', ['accountId', 'realm'])
@Index('idx_auth_session_family', ['familyId', 'realm', 'accountId'])
/** Persistence model for hashed, realm-scoped, rotating refresh-token sessions. */
export class AuthSession {
  @PrimaryColumn({ name: 'session_id', type: 'uuid' })
  sessionId: string;

  @Column({ name: 'account_id', type: 'uuid' })
  accountId: string;

  @Column({ type: 'varchar', length: 32 })
  realm: 'customer' | 'administration';

  @Column({ name: 'family_id', type: 'uuid' })
  familyId: string;

  @Column({ name: 'refresh_token_hash', type: 'varchar', length: 64 })
  refreshTokenHash: string;

  @Column({ name: 'expires_at', type: 'timestamp' })
  expiresAt: Date;

  @Column({ name: 'absolute_expires_at', type: 'timestamp' })
  absoluteExpiresAt: Date;

  @Column({
    name: 'created_at',
    type: 'timestamp',
    default: () => 'CURRENT_TIMESTAMP',
  })
  createdAt: Date;

  @Column({ name: 'last_used_at', type: 'timestamp', nullable: true })
  lastUsedAt: Date | null;

  @Column({ name: 'revoked_at', type: 'timestamp', nullable: true })
  revokedAt: Date | null;

  @Column({ name: 'revoke_reason', type: 'varchar', nullable: true })
  revokeReason: string | null;

  @Column({ name: 'replaced_by_session_id', type: 'uuid', nullable: true })
  replacedBySessionId: string | null;

  @Column({ name: 'user_agent', type: 'varchar', nullable: true })
  userAgent: string | null;
}
