import {
  Check,
  CreateDateColumn,
  Entity,
  Index,
  Column,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';

/** Mutable retry and lease state kept separate from the immutable event. */
@Entity('tbl_outbox_delivery')
@Check('chk_outbox_delivery_attempt_count', '"attempt_count" >= 0')
@Check(
  'chk_outbox_delivery_lease_pair',
  '(("lease_owner" IS NULL AND "leased_until" IS NULL) OR ("lease_owner" IS NOT NULL AND "leased_until" IS NOT NULL))',
)
@Index(
  'idx_outbox_delivery_pending',
  ['nextAttemptAt', 'leasedUntil', 'eventId'],
  { where: '"delivered_at" IS NULL' },
)
export class OutboxDelivery {
  @PrimaryColumn({ name: 'event_id', type: 'uuid' })
  eventId: string;

  @Column({ name: 'attempt_count', type: 'integer', default: 0 })
  attemptCount: number;

  @Column({
    name: 'next_attempt_at',
    type: 'timestamptz',
    default: () => 'NOW()',
  })
  nextAttemptAt: Date;

  @Column({ name: 'lease_owner', type: 'varchar', length: 128, nullable: true })
  leaseOwner: string | null;

  @Column({ name: 'leased_until', type: 'timestamptz', nullable: true })
  leasedUntil: Date | null;

  @Column({ name: 'delivered_at', type: 'timestamptz', nullable: true })
  deliveredAt: Date | null;

  @Column({
    name: 'last_error_code',
    type: 'varchar',
    length: 128,
    nullable: true,
  })
  lastErrorCode: string | null;

  @Column({ name: 'last_error_message', type: 'text', nullable: true })
  lastErrorMessage: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
