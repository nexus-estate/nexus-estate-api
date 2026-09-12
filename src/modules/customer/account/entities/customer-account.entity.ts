import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../../../../services/abstraction-services';

@Entity('tbl_customer_account')
export class CustomerAccount extends BaseEntity {
  @Column({ type: 'varchar', nullable: false, unique: true })
  email: string;

  @Column({ type: 'varchar', nullable: false, select: false })
  password: string;

  @Index()
  /** @deprecated Physical compatibility column; not used for authorization. */
  @Column({ name: 'role_id', type: 'uuid', nullable: true })
  roleId?: string | null;

  @Column({
    name: 'is_email_verified',
    type: 'boolean',
    default: false,
  })
  isEmailVerified: boolean;

  @Column({ type: 'timestamp', nullable: true })
  lastLogin: Date | null;

  /** @deprecated Non-persisted compatibility shape; never used by auth. */
  role: {
    id: string;
    name: string;
    description: string | null;
    isSystem: boolean;
  };
}

/** @deprecated Use CustomerAccount in new code. */
