import { Column, Entity, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { CustomerAccount } from '../../account/entities/customer-account.entity';
import { MarketplaceRole } from './marketplace-role.entity';
import type { Relation } from 'typeorm';

@Entity('tbl_customer_role_assignment')
export class CustomerRoleAssignment {
  @PrimaryColumn({ name: 'customer_id', type: 'uuid' })
  customerId: string;

  @PrimaryColumn({ name: 'role_id', type: 'uuid' })
  roleId: string;

  @Column({ name: 'assigned_at', type: 'timestamp', default: 'now()' })
  assignedAt: Date;

  @Column({ name: 'assigned_by_admin_id', type: 'uuid', nullable: true })
  assignedByAdminId: string | null;

  @Column({ type: 'text', nullable: true })
  reason: string | null;

  @ManyToOne(() => CustomerAccount, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'customer_id', referencedColumnName: 'id' })
  customer: Relation<CustomerAccount>;

  @ManyToOne(() => MarketplaceRole, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'role_id', referencedColumnName: 'id' })
  role: Relation<MarketplaceRole>;
}
