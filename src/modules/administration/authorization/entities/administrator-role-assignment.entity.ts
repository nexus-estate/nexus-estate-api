import { Column, Entity, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { AdministratorAccount } from '../../authentication/entities/administrator-account.entity';
import { AdministrationRole } from './administration-role.entity';
import type { Relation } from 'typeorm';

@Entity('tbl_administrator_role_assignment')
export class AdministratorRoleAssignment {
  @PrimaryColumn({ name: 'administrator_id', type: 'uuid' })
  administratorId: string;

  @PrimaryColumn({ name: 'role_id', type: 'uuid' })
  roleId: string;

  @Column({ name: 'assigned_at', type: 'timestamp', default: 'now()' })
  assignedAt: Date;

  @Column({ name: 'assigned_by_admin_id', type: 'uuid', nullable: true })
  assignedByAdminId: string | null;

  @ManyToOne(() => AdministratorAccount, {
    nullable: false,
    onDelete: 'RESTRICT',
  })
  @JoinColumn({
    name: 'administrator_id',
    referencedColumnName: 'id',
    foreignKeyConstraintName: 'fk_administrator_role_assignment_admin',
  })
  administrator: Relation<AdministratorAccount>;

  @ManyToOne(() => AdministrationRole, (role) => role.assignments, {
    nullable: false,
    onDelete: 'RESTRICT',
  })
  @JoinColumn({
    name: 'role_id',
    referencedColumnName: 'id',
    foreignKeyConstraintName: 'fk_administrator_role_assignment_role',
  })
  role: Relation<AdministrationRole>;
}
