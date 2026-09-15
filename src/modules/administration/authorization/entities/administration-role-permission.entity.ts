import { Entity, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { AdministrationPermission } from './administration-permission.entity';
import { AdministrationRole } from './administration-role.entity';
import type { Relation } from 'typeorm';

@Entity('tbl_administration_role_permission')
export class AdministrationRolePermission {
  @PrimaryColumn({ name: 'role_id', type: 'uuid' })
  roleId: string;

  @PrimaryColumn({ name: 'permission_id', type: 'uuid' })
  permissionId: string;

  @ManyToOne(() => AdministrationRole, (role) => role.rolePermissions, {
    nullable: false,
    onDelete: 'RESTRICT',
  })
  @JoinColumn({
    name: 'role_id',
    referencedColumnName: 'id',
    foreignKeyConstraintName: 'fk_administration_role_permission_role',
  })
  role: Relation<AdministrationRole>;

  @ManyToOne(
    () => AdministrationPermission,
    (permission) => permission.rolePermissions,
    { nullable: false, onDelete: 'RESTRICT' },
  )
  @JoinColumn({
    name: 'permission_id',
    referencedColumnName: 'id',
    foreignKeyConstraintName: 'fk_administration_role_permission_permission',
  })
  permission: Relation<AdministrationPermission>;
}
