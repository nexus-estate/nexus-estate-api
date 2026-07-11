import {
  Entity,
  Column,
  Unique,
  ManyToOne,
  JoinColumn,
  OneToMany,
} from 'typeorm';
import { Exclude } from 'class-transformer';
import { BaseEntity } from '../../../services/abstraction-services/base.entity';
import { Role } from '../../rbac/entities/role.entity';
import { DataPool } from './data-pool.entity';

@Entity('tbl_user')
@Unique(['email'])
export class User extends BaseEntity {
  @Column({ unique: true })
  email: string;

  @Column()
  @Exclude()
  password: string;

  @Column({ name: 'role_id' })
  roleId: string;

  @Column({ name: 'is_email_verified', default: false })
  isEmailVerified: boolean;

  @Column({ name: 'last_login', nullable: true })
  lastLogin: Date;

  @ManyToOne(() => Role)
  @JoinColumn({ name: 'role_id' })
  role: Role;

  @OneToMany(() => DataPool, (dp) => dp.user)
  dataPools: DataPool[];
}
