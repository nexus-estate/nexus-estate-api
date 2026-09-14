import { Column, Entity, Index } from 'typeorm';

import { BaseEntity } from '../../../../services/abstraction-services';

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

  /** @deprecated Physical compatibility column; administration uses assignments. */
  @Column({ name: 'role_id', type: 'uuid', nullable: true })
  roleId?: string | null;

  /** Allows operations to disable a credential without deleting history. */
  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  /** Last successful administration login. */
  @Column({ name: 'last_login', type: 'timestamp', nullable: true })
  lastLogin: Date | null;
}
