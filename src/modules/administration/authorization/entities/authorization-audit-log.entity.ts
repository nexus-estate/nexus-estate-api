import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../../../../services/abstraction-services';

@Entity('tbl_authorization_audit_log')
@Index('idx_authorization_audit_platform_created_at', ['platform', 'createdAt'])
@Index('idx_authorization_audit_target', ['targetType', 'targetId'])
export class AuthorizationAuditLog extends BaseEntity {
  @Column({ name: 'actor_administrator_id', type: 'uuid' })
  actorAdministratorId: string;

  @Column({ type: 'varchar', length: 32 })
  platform: string;

  @Column({ type: 'varchar', length: 64 })
  action: string;

  @Column({ name: 'target_type', type: 'varchar', length: 64 })
  targetType: string;

  @Column({ name: 'target_id', type: 'uuid', nullable: true })
  targetId: string | null;

  @Column({ type: 'text', nullable: true })
  reason: string | null;

  @Column({ name: 'before_state', type: 'jsonb', nullable: true })
  beforeState: Record<string, unknown> | null;

  @Column({ name: 'after_state', type: 'jsonb', nullable: true })
  afterState: Record<string, unknown> | null;

  @Column({ name: 'request_id', type: 'varchar', length: 255, nullable: true })
  requestId: string | null;
}
