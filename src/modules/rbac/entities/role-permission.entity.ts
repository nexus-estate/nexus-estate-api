import { Entity, Index, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { Permission } from './permission.entity';
import { Role } from './role.entity';
import type { Relation } from 'typeorm';

@Entity('tbl_role_permissions')
export class RolePermission {
  @PrimaryColumn({
    name: 'role_id',
    type: 'uuid',
    primaryKeyConstraintName: 'PK_63c7980c2b68efdd91862aab1eb',
  })
  roleId: string;

  @Index('idx_role_permissions_permission_id')
  @PrimaryColumn({
    name: 'permission_id',
    type: 'uuid',
    primaryKeyConstraintName: 'PK_63c7980c2b68efdd91862aab1eb',
  })
  permissionId: string;

  @ManyToOne(() => Role, (role) => role.rolePermissions, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({
    name: 'role_id',
    foreignKeyConstraintName: 'fk_role_permissions_role',
  })
  role: Relation<Role>;

  @ManyToOne(() => Permission, (permission) => permission.rolePermissions, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({
    name: 'permission_id',
    foreignKeyConstraintName: 'fk_role_permissions_permission',
  })
  permission: Relation<Permission>;
}
