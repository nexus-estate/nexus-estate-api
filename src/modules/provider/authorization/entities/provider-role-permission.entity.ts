import { Entity, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { ProviderPermission } from './provider-permission.entity';
import { ProviderRole } from './provider-role.entity';
import type { Relation } from 'typeorm';

@Entity('tbl_provider_role_permission')
export class ProviderRolePermission {
  @PrimaryColumn({ name: 'role_id', type: 'uuid' })
  roleId: string;

  @PrimaryColumn({ name: 'permission_id', type: 'uuid' })
  permissionId: string;

  @ManyToOne(() => ProviderRole, (role) => role.rolePermissions, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'role_id', referencedColumnName: 'id' })
  role: Relation<ProviderRole>;

  @ManyToOne(
    () => ProviderPermission,
    (permission) => permission.rolePermissions,
    {
      onDelete: 'CASCADE',
    },
  )
  @JoinColumn({ name: 'permission_id', referencedColumnName: 'id' })
  permission: Relation<ProviderPermission>;
}
