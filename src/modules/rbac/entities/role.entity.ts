import { Column, Entity, OneToMany } from 'typeorm';
import { BaseEntity } from '../../../services/abstraction-services';
import { RolePermission } from './role-permission.entity';
import type { Relation } from 'typeorm';

@Entity('tbl_role')
export class Role extends BaseEntity {
  @Column({ type: 'varchar', nullable: false, unique: true })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'boolean', default: false })
  isSystem: boolean;

  @OneToMany(() => RolePermission, (rolePermission) => rolePermission.role)
  rolePermissions: Relation<RolePermission[]>;
}
