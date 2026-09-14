import { Injectable } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { BusinessException } from '../../../../common/exceptions/business.exception';
import { ProviderAccountErrorCodes } from '../../account/errors/provider-account-error-codes';

/**
 * Provider runtime authorization service. Use it to provision the initial
 * owner membership or evaluate effective provider authority for a selected
 * customer membership. It reads platform-owned tables, excludes deprecated
 * permissions, rejects ambiguous/no context, and never chooses a provider by
 * join order; mutation policy remains in the provider account/supply services.
 */
@Injectable()
export class ProviderAuthorizationService {
  constructor(private readonly dataSource: DataSource) {}

  /** Ensures a newly-created provider owner has its IA-02 membership and role. */
  /**
   * Ensures the provider creator has one active membership with the immutable
   * OWNER role. Call this immediately after provider-account creation so the
   * account cannot exist without its initial provider authority.
   */
  async ensureOwnerMembership(
    manager: EntityManager,
    providerId: string,
    customerId: string,
  ): Promise<void> {
    const ownerRoles = await manager.query<{ id: string }[]>(
      `SELECT id FROM tbl_provider_role
         WHERE code = 'OWNER' AND deleted_at IS NULL AND status = 'ACTIVE'
         LIMIT 1`,
    );
    const ownerRoleId = ownerRoles[0]?.id;
    if (!ownerRoleId) {
      throw new BusinessException(
        ProviderAccountErrorCodes.PROVIDER_ACCOUNT_FORBIDDEN,
      );
    }
    const memberships = await manager.query<{ id: string }[]>(
      `INSERT INTO tbl_provider_membership (provider_id, customer_id, status)
         VALUES ($1, $2, 'ACTIVE')
         ON CONFLICT (provider_id, customer_id) DO UPDATE
           SET status = 'ACTIVE', deleted_at = NULL, updated_at = CURRENT_TIMESTAMP
         RETURNING id`,
      [providerId, customerId],
    );
    const membershipId = memberships[0]?.id;
    if (!membershipId) {
      throw new BusinessException(
        ProviderAccountErrorCodes.PROVIDER_ACCOUNT_FORBIDDEN,
      );
    }
    await manager.query(
      `INSERT INTO tbl_provider_membership_role (membership_id, role_id)
         VALUES ($1, $2) ON CONFLICT (membership_id, role_id) DO NOTHING`,
      [membershipId, ownerRoleId],
    );
  }

  /** Legacy Estate remains owner-only until explicit Estate permissions exist. */
  async requireLegacyEstateOwner(
    customerId: string,
    providerId: string,
  ): Promise<void> {
    const authority = await this.effective(customerId, providerId);
    if (!authority.roles.some((role) => role.code === 'OWNER')) {
      throw new BusinessException(
        ProviderAccountErrorCodes.PROVIDER_ACCOUNT_FORBIDDEN,
      );
    }
  }

  /**
   * Resolves effective provider permissions for an explicitly selected
   * membership, or for the customer's sole active membership. Ambiguous or
   * absent context fails closed instead of selecting a provider arbitrarily.
   */
  async effective(customerId: string, providerId?: string) {
    if (providerId && !UUID_PATTERN.test(providerId)) {
      throw new BusinessException(
        ProviderAccountErrorCodes.PROVIDER_ACCOUNT_FORBIDDEN,
      );
    }
    const parameters: string[] = [customerId];
    const providerFilter = providerId
      ? (() => {
          parameters.push(providerId);
          return 'AND provider.id = $2';
        })()
      : '';
    // The provider identifier is a context selector, never a hint for a
    // fallback query; all effective permissions must come from that row.
    const membershipRows = await this.dataSource.query<MembershipRow[]>(
      `SELECT membership.id AS membership_id, membership.provider_id,
              membership.status AS membership_status, provider.status AS provider_status,
              provider.verification_status, provider.display_name
       FROM tbl_provider_membership membership
       INNER JOIN tbl_provider_account provider ON provider.id = membership.provider_id
       WHERE membership.customer_id = $1 AND membership.deleted_at IS NULL
         AND provider.deleted_at IS NULL ${providerFilter}
       ORDER BY membership.joined_at ASC, membership.id ASC`,
      parameters,
    );
    if (membershipRows.length === 0) {
      throw new BusinessException(
        providerId
          ? ProviderAccountErrorCodes.PROVIDER_ACCOUNT_FORBIDDEN
          : ProviderAccountErrorCodes.PROVIDER_ACCOUNT_NOT_FOUND,
      );
    }
    if (providerId && membershipRows[0]?.membership_status !== 'ACTIVE') {
      throw new BusinessException(
        ProviderAccountErrorCodes.PROVIDER_ACCOUNT_FORBIDDEN,
      );
    }
    const activeMemberships = membershipRows.filter(
      (candidate) => candidate.membership_status === 'ACTIVE',
    );
    if (!providerId && activeMemberships.length > 1) {
      throw new BusinessException(
        ProviderAccountErrorCodes.PROVIDER_CONTEXT_REQUIRED,
      );
    }
    const membership = providerId
      ? membershipRows[0]
      : (activeMemberships[0] ??
        (membershipRows.length === 1 ? membershipRows[0] : undefined));
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

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
