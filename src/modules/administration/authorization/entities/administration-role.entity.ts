import { Column, Entity, Index, OneToMany } from 'typeorm';
import { BaseEntity } from '../../../../services/abstraction-services';
import { AdministrationRolePermission } from './administration-role-permission.entity';
import { AdministratorRoleAssignment } from './administrator-role-assignment.entity';
import type { Relation } from 'typeorm';
import { AuthorizationRoleStatus } from '../enums/authorization-platform.enum';

@Entity('tbl_administration_role')
@Index('uq_administration_role_code', ['code'], { unique: true })
export class AdministrationRole extends BaseEntity {
  @Column({ type: 'varchar', length: 100, nullable: false })
  code: string;

  @Column({ type: 'varchar', length: 255, nullable: false })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ name: 'is_system', type: 'boolean', default: false })
  isSystem: boolean;

  @Column({
    type: 'varchar',
    length: 16,
    default: AuthorizationRoleStatus.ACTIVE,
  })
  status: AuthorizationRoleStatus;

  @Column({ type: 'integer', default: 1 })
  version: number;

  @OneToMany(() => AdministrationRolePermission, (mapping) => mapping.role)
  rolePermissions: Relation<AdministrationRolePermission[]>;

  @OneToMany(() => AdministratorRoleAssignment, (assignment) => assignment.role)
  assignments: Relation<AdministratorRoleAssignment[]>;
}
