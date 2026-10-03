import {
  Check,
  CreateDateColumn,
  Entity,
  Index,
  Column,
  PrimaryColumn,
} from 'typeorm';

/** Immutable event data committed with its source mutation and revision. */
@Entity('tbl_outbox_event')
@Check('chk_outbox_event_revision_positive', '"revision" >= 1')
@Index(
  'uq_outbox_event_stream_revision_type',
  ['aggregateType', 'aggregateId', 'revision', 'eventType'],
  { unique: true },
)
@Index('idx_outbox_event_created_at', ['createdAt', 'eventId'])
@Index('idx_outbox_event_aggregate_revision', [
  'aggregateType',
  'aggregateId',
  'revision',
])
export class OutboxEvent {
  @PrimaryColumn({ name: 'event_id', type: 'uuid' })
  eventId: string;

  @Column({ name: 'event_type', type: 'varchar', length: 160 })
  eventType: string;

  @Column({ name: 'aggregate_type', type: 'varchar', length: 64 })
  aggregateType: string;

  @Column({ name: 'aggregate_id', type: 'uuid' })
  aggregateId: string;

  @Column({ type: 'bigint' })
  revision: string;

  @Column({ name: 'occurred_at', type: 'timestamptz' })
  occurredAt: Date;

  @Column({ name: 'trace_id', type: 'varchar', length: 128, nullable: true })
  traceId: string | null;

  @Column({ type: 'jsonb' })
  payload: unknown;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
