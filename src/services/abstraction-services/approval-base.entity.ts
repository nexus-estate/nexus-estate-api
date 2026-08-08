import { Column } from 'typeorm';
import { BaseEntity } from './base.entity';

export enum ApprovalStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
}

export abstract class ApprovalBaseEntity extends BaseEntity {
  @Column({ type: 'varchar', default: ApprovalStatus.PENDING })
  status: ApprovalStatus;

  @Column({ nullable: true })
  approvedBy?: string;

  @Column({ nullable: true })
  approvedDate?: Date;

  @Column({ nullable: true })
  rejectedBy?: string;

  @Column({ nullable: true })
  rejectedDate?: Date;

  @Column({ type: 'text', nullable: true })
  rejectionReason?: string;
}
