import { Column, Entity, OneToMany } from 'typeorm';
import { BaseEntity } from '../../../services/abstraction-services';
import { RolePermission } from './role-permission.entity';
import type { Relation } from 'typeorm';

@Entity('tbl_permission')
export class Permission extends BaseEntity {
  @Column({ type: 'varchar', nullable: false, unique: true })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @OneToMany(
    () => RolePermission,
    (rolePermission) => rolePermission.permission,
  )
  rolePermissions: Relation<RolePermission[]>;
}
