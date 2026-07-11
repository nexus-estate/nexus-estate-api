import { Entity, Column, OneToMany } from 'typeorm';
import { BaseEntity } from '../../../services/abstraction-services/base.entity';
import { Permission } from './permission.entity';

@Entity('tbl_role')
export class Role extends BaseEntity {
  @Column({ unique: true })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ default: false })
  isSystem: boolean;

  @OneToMany(() => Permission, (perm) => perm.role)
  permissions: Permission[];
}
