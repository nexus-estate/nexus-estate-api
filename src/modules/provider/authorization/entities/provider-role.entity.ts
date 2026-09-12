import { Column, Entity, Index, OneToMany } from 'typeorm';
import { BaseEntity } from '../../../../services/abstraction-services';
import { ProviderRolePermission } from './provider-role-permission.entity';
import { ProviderMembershipRole } from './provider-membership-role.entity';
import type { Relation } from 'typeorm';

@Entity('tbl_provider_role')
@Index('uq_provider_role_code', ['code'], { unique: true })
export class ProviderRole extends BaseEntity {
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

  @OneToMany(() => ProviderRolePermission, (mapping) => mapping.role)
  rolePermissions: Relation<ProviderRolePermission[]>;

  @OneToMany(() => ProviderMembershipRole, (assignment) => assignment.role)
  assignments: Relation<ProviderMembershipRole[]>;
}
