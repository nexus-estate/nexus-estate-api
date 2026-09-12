import { Check, Column, Entity, Index, JoinColumn, OneToOne } from 'typeorm';
import type { Relation } from 'typeorm';

import { BaseEntity } from '../../../../services/abstraction-services';
import { User } from '../../../../modules/user/entities/user.entity';
import {
  SellerStatus,
  SellerType,
  SellerVerificationStatus,
} from '../enums/account.enums';

@Entity('tbl_seller_account')
@Check(
  'chk_seller_account_type',
  `"type" IN ('INDIVIDUAL', 'BROKER', 'AGENCY')`,
)
@Check('chk_seller_account_status', `"status" IN ('ACTIVE', 'SUSPENDED')`)
@Check(
  'chk_seller_account_verification_status',
  `"verification_status" IN ('UNVERIFIED', 'PENDING', 'VERIFIED', 'REJECTED')`,
)
@Index('uq_seller_account_owner_user_id', ['ownerUserId'], { unique: true })
@Index('idx_seller_account_status', ['status'])
@Index('idx_seller_account_type', ['type'])
/** TypeORM model for the seller-account persistence contract. */
export class SellerAccount extends BaseEntity {
  /** User who owns this account; one user may own at most one account. */
  @Column({ name: 'owner_user_id', type: 'uuid', nullable: false })
  ownerUserId: string;

  /** Relation used when a use case needs the owning user record. */
  @OneToOne(() => User, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({
    name: 'owner_user_id',
    referencedColumnName: 'id',
    foreignKeyConstraintName: 'fk_seller_account_owner_user',
  })
  owner: Relation<User>;

  /** Operating model selected by the seller. */
  @Column({ type: 'varchar', length: 32, nullable: false })
  type: SellerType;

  /** Name visible to marketplace consumers. */
  @Column({
    name: 'display_name',
    type: 'varchar',
    length: 255,
    nullable: false,
  })
  displayName: string;

  /** Lifecycle state used by seller policy checks. */
  @Column({ type: 'varchar', length: 32, default: SellerStatus.ACTIVE })
  status: SellerStatus;

  /** Compliance/onboarding state for future verification workflows. */
  @Column({
    name: 'verification_status',
    type: 'varchar',
    length: 32,
    default: SellerVerificationStatus.UNVERIFIED,
  })
  verificationStatus: SellerVerificationStatus;
}
