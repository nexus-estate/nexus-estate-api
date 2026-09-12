import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
} from 'typeorm';
import { BaseEntity } from '../../../../services/abstraction-services';
import { CustomerAccount } from '../../../customer/account/entities/customer-account.entity';
import { ProviderAccount } from '../../account/entities/provider-account.entity';
import { ProviderMembershipRole } from './provider-membership-role.entity';
import type { Relation } from 'typeorm';

@Entity('tbl_provider_membership')
@Index(
  'uq_provider_membership_provider_customer',
  ['providerId', 'customerId'],
  {
    unique: true,
  },
)
export class ProviderMembership extends BaseEntity {
  @Column({ name: 'provider_id', type: 'uuid' })
  providerId: string;

  @Column({ name: 'customer_id', type: 'uuid' })
  customerId: string;

  @Column({ type: 'varchar', length: 16, default: 'ACTIVE' })
  status: 'ACTIVE' | 'SUSPENDED' | 'REMOVED';

  @Column({ name: 'joined_at', type: 'timestamp', default: 'now()' })
  joinedAt: Date;

  @ManyToOne(() => ProviderAccount, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'provider_id', referencedColumnName: 'id' })
  provider: Relation<ProviderAccount>;

  @ManyToOne(() => CustomerAccount, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'customer_id', referencedColumnName: 'id' })
  customer: Relation<CustomerAccount>;

  @OneToMany(
    () => ProviderMembershipRole,
    (assignment) => assignment.membership,
  )
  roleAssignments: Relation<ProviderMembershipRole[]>;
}
