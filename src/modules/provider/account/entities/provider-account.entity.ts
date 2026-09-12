import { Check, Column, Entity, Index, JoinColumn, OneToOne } from 'typeorm';
import type { Relation } from 'typeorm';

import { BaseEntity } from '../../../../services/abstraction-services';
import { CustomerAccount } from '../../../customer/account/entities/customer-account.entity';
import {
  ProviderStatus,
  ProviderType,
  ProviderVerificationStatus,
} from '../enums/account.enums';

@Entity('tbl_provider_account')
@Check(
  'chk_provider_account_type',
  `"type" IN ('INDIVIDUAL', 'BROKER', 'AGENCY')`,
)
@Check('chk_provider_account_status', `"status" IN ('ACTIVE', 'SUSPENDED')`)
@Check(
  'chk_provider_account_verification_status',
  `"verification_status" IN ('UNVERIFIED', 'PENDING', 'VERIFIED', 'REJECTED')`,
)
@Index('uq_provider_account_owner_customer_id', ['ownerCustomerId'], {
  unique: true,
})
@Index('idx_provider_account_status', ['status'])
@Index('idx_provider_account_type', ['type'])
/** TypeORM model for the provider-account persistence contract. */
export class ProviderAccount extends BaseEntity {
  /** Customer account who owns this account; one customer may own one account. */
  @Column({ name: 'owner_customer_id', type: 'uuid', nullable: false })
  ownerCustomerId: string;

  /** @deprecated Use ownerCustomerId in new code. */
  /** Relation used when a use case needs the owning customer record. */
  @OneToOne(() => CustomerAccount, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({
    name: 'owner_customer_id',
    referencedColumnName: 'id',
    foreignKeyConstraintName: 'fk_provider_account_owner_customer',
  })
  owner: Relation<CustomerAccount>;

  /** Operating model selected by the provider. */
  @Column({ type: 'varchar', length: 32, nullable: false })
  type: ProviderType;

  /** Name visible to marketplace customers. */
  @Column({
    name: 'display_name',
    type: 'varchar',
    length: 255,
    nullable: false,
  })
  displayName: string;

  /** Lifecycle state used by provider policy checks. */
  @Column({ type: 'varchar', length: 32, default: ProviderStatus.ACTIVE })
  status: ProviderStatus;

  /** Compliance/onboarding state for future verification workflows. */
  @Column({
    name: 'verification_status',
    type: 'varchar',
    length: 32,
    default: ProviderVerificationStatus.UNVERIFIED,
  })
  verificationStatus: ProviderVerificationStatus;
}
