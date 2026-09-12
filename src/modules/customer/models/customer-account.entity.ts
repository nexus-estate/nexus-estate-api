import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../services/abstraction-services';
import { Role } from '../../rbac/entities/role.entity';
import type { Relation } from 'typeorm';

@Entity('tbl_customer_account')
export class CustomerAccount extends BaseEntity {
  @Column({ type: 'varchar', nullable: false, unique: true })
  email: string;

  @Column({ type: 'varchar', nullable: false, select: false })
  password: string;

  @Index()
  @Column({ name: 'role_id', type: 'uuid', nullable: false })
  roleId: string;

  @Column({
    name: 'is_email_verified',
    type: 'boolean',
    default: false,
  })
  isEmailVerified: boolean;

  @Column({ type: 'timestamp', nullable: true })
  lastLogin: Date | null;

  @ManyToOne(() => Role, {
    nullable: false,
    onDelete: 'RESTRICT',
  })
  @JoinColumn({
    name: 'role_id',
    foreignKeyConstraintName: 'fk_customer_account_role',
  })
  role: Relation<Role>;
}

/** @deprecated Use CustomerAccount in new code. */
