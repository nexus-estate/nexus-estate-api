import { Column, Entity, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { ProviderMembership } from './provider-membership.entity';
import { ProviderRole } from './provider-role.entity';
import type { Relation } from 'typeorm';

@Entity('tbl_provider_membership_role')
export class ProviderMembershipRole {
  @PrimaryColumn({ name: 'membership_id', type: 'uuid' })
  membershipId: string;

  @PrimaryColumn({ name: 'role_id', type: 'uuid' })
  roleId: string;

  @Column({ name: 'assigned_at', type: 'timestamp', default: 'now()' })
  assignedAt: Date;

  @Column({ name: 'assigned_by_admin_id', type: 'uuid', nullable: true })
  assignedByAdminId: string | null;

  @ManyToOne(
    () => ProviderMembership,
    (membership) => membership.roleAssignments,
    {
      onDelete: 'RESTRICT',
    },
  )
  @JoinColumn({ name: 'membership_id', referencedColumnName: 'id' })
  membership: Relation<ProviderMembership>;

  @ManyToOne(() => ProviderRole, (role) => role.assignments, {
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'role_id', referencedColumnName: 'id' })
  role: Relation<ProviderRole>;
}
