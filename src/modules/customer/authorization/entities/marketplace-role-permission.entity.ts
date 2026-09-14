import { Entity, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { MarketplacePermission } from './marketplace-permission.entity';
import { MarketplaceRole } from './marketplace-role.entity';
import type { Relation } from 'typeorm';

@Entity('tbl_marketplace_role_permission')
export class MarketplaceRolePermission {
  @PrimaryColumn({ name: 'role_id', type: 'uuid' })
  roleId: string;

  @PrimaryColumn({ name: 'permission_id', type: 'uuid' })
  permissionId: string;

  @ManyToOne(() => MarketplaceRole, (role) => role.rolePermissions, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'role_id', referencedColumnName: 'id' })
  role: Relation<MarketplaceRole>;

  @ManyToOne(
    () => MarketplacePermission,
    (permission) => permission.rolePermissions,
    {
      onDelete: 'CASCADE',
    },
  )
  @JoinColumn({ name: 'permission_id', referencedColumnName: 'id' })
  permission: Relation<MarketplacePermission>;
}
