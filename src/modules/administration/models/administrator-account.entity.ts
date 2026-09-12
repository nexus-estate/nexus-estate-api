import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import type { Relation } from 'typeorm';

import { BaseEntity } from '../../../services/abstraction-services';
import { Role } from '../../rbac/entities/role.entity';

/** Persistence model for credentials used by the internal administration portal. */
@Entity('tbl_administrator_account')
@Index('uq_administrator_account_email', ['email'], { unique: true })
export class AdministratorAccount extends BaseEntity {
  /** Administrator email used by the dedicated authentication flow. */
  @Column({ type: 'varchar', nullable: false })
  email: string;

  /** Hashed administrator password; never selected by public queries. */
  @Column({ type: 'varchar', nullable: false, select: false })
  password: string;

  /** RBAC role for internal portal authorization. */
  @Column({ name: 'role_id', type: 'uuid', nullable: false })
  roleId: string;

  /** Allows operations to disable a credential without deleting history. */
  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  /** Last successful administration login. */
  @Column({ name: 'last_login', type: 'timestamp', nullable: true })
  lastLogin: Date | null;

  /** Associated persisted administration role. */
  @ManyToOne(() => Role, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({
    name: 'role_id',
    referencedColumnName: 'id',
    foreignKeyConstraintName: 'fk_administrator_account_role',
  })
  role: Relation<Role>;
}
