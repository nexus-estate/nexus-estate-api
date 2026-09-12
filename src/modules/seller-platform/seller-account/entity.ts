import { Column, Entity, Index, JoinColumn, OneToOne } from 'typeorm';
import type { Relation } from 'typeorm';

import { BaseEntity } from '../../../services/abstraction-services';
import { User } from '../../../modules/user/entities/user.entity';
import { SellerStatus, SellerType, SellerVerificationStatus } from './enums';

@Entity('tbl_seller_account')
@Index('uq_seller_account_owner_user_id', ['ownerUserId'], { unique: true })
@Index('idx_seller_account_status', ['status'])
@Index('idx_seller_account_type', ['type'])
export class SellerAccount extends BaseEntity {
  @Column({ name: 'owner_user_id', type: 'uuid', nullable: false })
  ownerUserId: string;

  @OneToOne(() => User, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({
    name: 'owner_user_id',
    referencedColumnName: 'id',
    foreignKeyConstraintName: 'fk_seller_account_owner_user',
  })
  owner: Relation<User>;

  @Column({ type: 'varchar', length: 32, nullable: false })
  type: SellerType;

  @Column({
    name: 'display_name',
    type: 'varchar',
    length: 255,
    nullable: false,
  })
  displayName: string;

  @Column({ type: 'varchar', length: 32, default: SellerStatus.ACTIVE })
  status: SellerStatus;

  @Column({
    name: 'verification_status',
    type: 'varchar',
    length: 32,
    default: SellerVerificationStatus.UNVERIFIED,
  })
  verificationStatus: SellerVerificationStatus;
}
