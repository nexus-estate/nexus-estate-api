import { Column, Entity, Index, OneToMany } from 'typeorm';
import { BaseEntity } from '../../../../services/abstraction-services';
import { AdministrationRolePermission } from './administration-role-permission.entity';
import type { Relation } from 'typeorm';
import { AuthorizationRiskLevel } from '../enums/authorization-platform.enum';

@Entity('tbl_administration_permission')
@Index('uq_administration_permission_code', ['code'], { unique: true })
export class AdministrationPermission extends BaseEntity {
  @Column({ type: 'varchar', length: 150, nullable: false })
  code: string;

  @Column({ type: 'varchar', length: 255, nullable: false, default: '' })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'varchar', length: 100, default: 'Administration' })
  category: string;

  @Column({ type: 'varchar', length: 100, default: 'authorization' })
  resource: string;

  @Column({ type: 'varchar', length: 100, default: 'manage' })
  action: string;

  @Column({
    name: 'risk_level',
    type: 'varchar',
    length: 16,
    default: AuthorizationRiskLevel.MEDIUM,
  })
  riskLevel: AuthorizationRiskLevel;

  @Column({ name: 'is_assignable', type: 'boolean', default: true })
  isAssignable: boolean;

  @Column({ name: 'deprecated_at', type: 'timestamp', nullable: true })
  deprecatedAt: Date | null;

  @OneToMany(
    () => AdministrationRolePermission,
    (mapping) => mapping.permission,
  )
  rolePermissions: Relation<AdministrationRolePermission[]>;
}
