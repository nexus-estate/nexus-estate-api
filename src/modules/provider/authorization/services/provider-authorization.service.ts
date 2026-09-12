import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

/** Resolves provider membership permissions and current provider policy state. */
@Injectable()
export class ProviderAuthorizationService {
  constructor(private readonly dataSource: DataSource) {}

  /** Ensures a newly-created provider owner has its IA-02 membership and role. */
  async ensureOwnerMembership(
    providerId: string,
    customerId: string,
  ): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const ownerRoles = await manager.query<{ id: string }[]>(
        `SELECT id FROM tbl_provider_role
         WHERE code = 'OWNER' AND deleted_at IS NULL AND status = 'ACTIVE'
         LIMIT 1`,
      );
      const ownerRoleId = ownerRoles[0]?.id;
      if (!ownerRoleId) return;
      const memberships = await manager.query<{ id: string }[]>(
        `INSERT INTO tbl_provider_membership (provider_id, customer_id, status)
         VALUES ($1, $2, 'ACTIVE')
         ON CONFLICT (provider_id, customer_id) DO UPDATE
           SET status = 'ACTIVE', deleted_at = NULL, updated_at = CURRENT_TIMESTAMP
         RETURNING id`,
        [providerId, customerId],
      );
      const membershipId = memberships[0]?.id;
      if (!membershipId) return;
      await manager.query(
        `INSERT INTO tbl_provider_membership_role (membership_id, role_id)
         VALUES ($1, $2) ON CONFLICT (membership_id, role_id) DO NOTHING`,
        [membershipId, ownerRoleId],
      );
    });
  }

  async effective(customerId: string) {
    const membershipRows = await this.dataSource.query<MembershipRow[]>(
      `SELECT membership.id AS membership_id, membership.provider_id,
              membership.status AS membership_status, provider.status AS provider_status,
              provider.verification_status, provider.display_name
       FROM tbl_provider_membership membership
       INNER JOIN tbl_provider_account provider ON provider.id = membership.provider_id
       WHERE membership.customer_id = $1 AND membership.deleted_at IS NULL
       ORDER BY membership.joined_at ASC LIMIT 1`,
      [customerId],
    );
    const membership = membershipRows[0];
    if (!membership) {
      return {
        platform: 'PROVIDER',
        providerId: null,
        membershipId: null,
        roles: [],
        permissions: [],
        providerStatus: null,
        verificationStatus: null,
        membershipStatus: null,
        authorizationVersion: new Date(0).toISOString(),
      };
    }
    const roles =
      membership.membership_status === 'ACTIVE'
        ? await this.dataSource.query<
            { id: string; code: string; name: string }[]
          >(
            `SELECT role.id, role.code, role.name
       FROM tbl_provider_membership_role assignment
       INNER JOIN tbl_provider_role role ON role.id = assignment.role_id
       WHERE assignment.membership_id = $1 AND role.status = 'ACTIVE'
         AND role.deleted_at IS NULL ORDER BY role.code`,
            [membership.membership_id],
          )
        : [];
    const permissions =
      membership.membership_status === 'ACTIVE'
        ? await this.dataSource.query<
            { id: string; code: string; name: string; category: string }[]
          >(
            `SELECT DISTINCT permission.id, permission.code, permission.name, permission.category
       FROM tbl_provider_membership_role assignment
       INNER JOIN tbl_provider_role role ON role.id = assignment.role_id
       INNER JOIN tbl_provider_role_permission mapping ON mapping.role_id = role.id
       INNER JOIN tbl_provider_permission permission ON permission.id = mapping.permission_id
       WHERE assignment.membership_id = $1 AND role.status = 'ACTIVE'
         AND role.deleted_at IS NULL AND permission.deleted_at IS NULL
         AND permission.deprecated_at IS NULL ORDER BY permission.code`,
            [membership.membership_id],
          )
        : [];
    return {
      platform: 'PROVIDER',
      providerId: membership.provider_id,
      membershipId: membership.membership_id,
      roles,
      permissions,
      providerStatus: membership.provider_status,
      verificationStatus: membership.verification_status,
      membershipStatus: membership.membership_status,
      providerDisplayName: membership.display_name,
      authorizationVersion: await this.version(membership.membership_id),
    };
  }

  private async version(membershipId: string): Promise<string> {
    const rows = await this.dataSource.query<{ version: string }[]>(
      `SELECT COALESCE(MAX(GREATEST(assignment.assigned_at, membership.updated_at, role.updated_at, COALESCE(permission.updated_at, TIMESTAMP 'epoch'))), TIMESTAMP 'epoch')::text AS version
       FROM tbl_provider_membership_role assignment
       INNER JOIN tbl_provider_membership membership ON membership.id = assignment.membership_id
       INNER JOIN tbl_provider_role role ON role.id = assignment.role_id
       LEFT JOIN tbl_provider_role_permission mapping ON mapping.role_id = role.id
       LEFT JOIN tbl_provider_permission permission ON permission.id = mapping.permission_id
       WHERE assignment.membership_id = $1`,
      [membershipId],
    );
    return rows[0]?.version ?? new Date(0).toISOString();
  }
}

type MembershipRow = {
  membership_id: string;
  provider_id: string;
  membership_status: string;
  provider_status: string;
  verification_status: string;
  display_name: string;
};
