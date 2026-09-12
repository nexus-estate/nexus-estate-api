import { Check, Column, Entity, Index, JoinColumn, OneToOne } from 'typeorm';
import type { Relation } from 'typeorm';

import { BaseEntity } from '../../../../services/abstraction-services';
import { BuyerAccount } from '../../../../modules/buyer/account/models/buyer-account.entity';
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
@Index('uq_seller_account_owner_buyer_id', ['ownerBuyerId'], { unique: true })
@Index('idx_seller_account_status', ['status'])
@Index('idx_seller_account_type', ['type'])
/** TypeORM model for the seller-account persistence contract. */
export class SellerAccount extends BaseEntity {
  /** Buyer account who owns this account; one buyer may own one account. */
  @Column({ name: 'owner_buyer_id', type: 'uuid', nullable: false })
  ownerBuyerId: string;

  /** Relation used when a use case needs the owning buyer record. */
  @OneToOne(() => BuyerAccount, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({
    name: 'owner_buyer_id',
    referencedColumnName: 'id',
    foreignKeyConstraintName: 'fk_seller_account_owner_buyer',
  })
  owner: Relation<BuyerAccount>;

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
