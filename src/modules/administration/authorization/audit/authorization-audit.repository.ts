import { Injectable } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import type { AuthorizationPlatform } from '../enums/authorization-platform.enum';

export type AuthorizationAuditEvent = {
  actorAdministratorId: string;
  platform: AuthorizationPlatform;
  action: string;
  targetType: string;
  targetId: string | null;
  reason: string | null;
  beforeState: Record<string, unknown> | null;
  afterState: Record<string, unknown> | null;
  requestId: string | null;
};

/** Persists audit records using the caller's transaction executor. */
@Injectable()
export class AuthorizationAuditRepository {
  async append(
    manager: EntityManager | DataSource,
    event: AuthorizationAuditEvent,
  ): Promise<void> {
    await manager.query(
      `INSERT INTO tbl_authorization_audit_log
        (actor_administrator_id, platform, action, target_type, target_id, reason, before_state, after_state, request_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb, $9)`,
      [
        event.actorAdministratorId,
        event.platform,
        event.action,
        event.targetType,
        event.targetId,
        event.reason,
        event.beforeState ? JSON.stringify(event.beforeState) : null,
        event.afterState ? JSON.stringify(event.afterState) : null,
        event.requestId,
      ],
    );
  }
}
