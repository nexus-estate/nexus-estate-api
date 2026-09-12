import { Column, Entity, Index, OneToMany } from 'typeorm';
import { BaseEntity } from '../../../../services/abstraction-services';
import { MarketplaceRolePermission } from './marketplace-role-permission.entity';
import type { Relation } from 'typeorm';

@Entity('tbl_marketplace_permission')
@Index('uq_marketplace_permission_code', ['code'], { unique: true })
export class MarketplacePermission extends BaseEntity {
  @Column({ type: 'varchar', length: 150 })
  code: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'text' })
  description: string;

  @Column({ type: 'varchar', length: 100 })
  category: string;

  @Column({ type: 'varchar', length: 100 })
  resource: string;

  @Column({ type: 'varchar', length: 100 })
  action: string;

  @Column({ name: 'risk_level', type: 'varchar', length: 16 })
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

  @Column({ name: 'is_assignable', type: 'boolean', default: true })
  isAssignable: boolean;

  @Column({ name: 'deprecated_at', type: 'timestamp', nullable: true })
  deprecatedAt: Date | null;

  @OneToMany(() => MarketplaceRolePermission, (mapping) => mapping.permission)
  rolePermissions: Relation<MarketplaceRolePermission[]>;
}
