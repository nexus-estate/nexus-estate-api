import { Column, Entity, Index, OneToMany } from 'typeorm';
import { BaseEntity } from '../../../../services/abstraction-services';
import { MarketplaceRolePermission } from './marketplace-role-permission.entity';
import type { Relation } from 'typeorm';

@Entity('tbl_marketplace_role')
@Index('uq_marketplace_role_code', ['code'], { unique: true })
export class MarketplaceRole extends BaseEntity {
  @Column({ type: 'varchar', length: 100 })
  code: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ name: 'is_system', type: 'boolean', default: false })
  isSystem: boolean;

  @Column({ type: 'varchar', length: 16, default: 'ACTIVE' })
  status: 'ACTIVE' | 'DISABLED';

  @Column({ type: 'integer', default: 1 })
  version: number;

  @OneToMany(() => MarketplaceRolePermission, (mapping) => mapping.role)
  rolePermissions: Relation<MarketplaceRolePermission[]>;
}
