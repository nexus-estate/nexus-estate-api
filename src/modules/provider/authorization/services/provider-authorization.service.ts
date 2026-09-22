import { Injectable } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { BusinessException } from '../../../../common/exceptions/business.exception';
import { ProviderAccountErrorCodes } from '../../account/errors/provider-account-error-codes';
import type { ProviderContext } from '../../account/services/provider-context.resolver';
import type {
  ProviderAuthorizationPermission,
  ProviderAuthorizationRole,
  ProviderEffectiveAuthorization,
} from '../types/provider-effective-authorization.contract';
import type { ProviderPermissionCode } from '../permissions/provider-permission.registry';

/**
 * Provider runtime authorization service. Use it to provision the initial
 * owner membership or evaluate effective provider authority for an
 * already-resolved provider context. It never selects provider context itself;
 * context selection belongs to ProviderContextResolver. It reads platform-owned
 * tables and excludes deprecated permissions.
 */
@Injectable()
export class ProviderAuthorizationService {
  constructor(private readonly dataSource: DataSource) {}

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

  /**
   * Rejects access unless the resolved membership holds the specified permission.
   */
  async requirePermission(
    context: ProviderContext,
    permissionCode: ProviderPermissionCode,
  ): Promise<void> {
    const authority = await this.effective(context);
    if (
      !authority.permissions.some(
        (permission) => permission.code === permissionCode,
      )
    ) {
      throw new BusinessException(
        ProviderAccountErrorCodes.PROVIDER_ACCOUNT_FORBIDDEN,
      );
    }
  }

  /**
   * Resolves effective provider permissions for the already-resolved provider
   * context. The context owns provider selection, so this method never queries
   * memberships to choose a provider.
   */
  async effective(
    context: ProviderContext,
  ): Promise<ProviderEffectiveAuthorization> {
    // Legacy fallback contexts have no IA-02 membership, and a non-active
    // membership must never surface roles or permissions.
    if (!context.membershipId || context.membershipStatus !== 'ACTIVE') {
      return {
        platform: 'PROVIDER',
        providerId: context.providerId,
        membershipId: context.membershipId,
        roles: [],
        permissions: [],
        providerStatus: context.providerStatus,
        verificationStatus: context.verificationStatus,
        membershipStatus: context.membershipStatus,
        providerDisplayName: context.providerDisplayName,
        authorizationVersion: new Date(0).toISOString(),
      };
    }

    const roles = await this.dataSource.query<ProviderAuthorizationRole[]>(
      `SELECT role.id, role.code, role.name
       FROM tbl_provider_membership_role assignment
       INNER JOIN tbl_provider_role role ON role.id = assignment.role_id
       WHERE assignment.membership_id = $1 AND role.status = 'ACTIVE'
         AND role.deleted_at IS NULL ORDER BY role.code`,
      [context.membershipId],
    );
    const permissions = await this.dataSource.query<
      ProviderAuthorizationPermission[]
    >(
      `SELECT DISTINCT permission.id, permission.code, permission.name, permission.category
         FROM tbl_provider_membership_role assignment
         INNER JOIN tbl_provider_role role ON role.id = assignment.role_id
         INNER JOIN tbl_provider_role_permission mapping ON mapping.role_id = role.id
         INNER JOIN tbl_provider_permission permission ON permission.id = mapping.permission_id
         WHERE assignment.membership_id = $1 AND role.status = 'ACTIVE'
           AND role.deleted_at IS NULL AND permission.deleted_at IS NULL
           AND permission.deprecated_at IS NULL ORDER BY permission.code`,
      [context.membershipId],
    );

    return {
      platform: 'PROVIDER',
      providerId: context.providerId,
      membershipId: context.membershipId,
      roles,
      permissions,
      providerStatus: context.providerStatus,
      verificationStatus: context.verificationStatus,
      membershipStatus: context.membershipStatus,
      providerDisplayName: context.providerDisplayName,
      authorizationVersion: await this.version(context.membershipId),
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
