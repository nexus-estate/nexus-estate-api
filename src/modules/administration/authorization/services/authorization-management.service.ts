import { Injectable, Optional } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';

import { BusinessException } from '../../../../common/exceptions/business.exception';
import { PaginationHelper } from '../../../../utils/helpers/pagination.helper';
import { AuthorizationErrorCodes } from '../errors/authorization-error-codes';
import { AUTHORIZATION_RECOVERY_PERMISSIONS } from '../constants/administration-permission.constant';
import { AuthorizationAuditService } from '../audit/authorization-audit.service';
import type { AuthorizationAuditEvent } from '../audit/authorization-audit.repository';
import {
  AuthorizationPlatform,
  AuthorizationRiskLevel,
  AuthorizationRoleStatus,
} from '../enums/authorization-platform.enum';
import type {
  AuthorizationAuditQueryDto,
  AuthorizationSubjectListQueryDto,
  CreateAuthorizationRoleDto,
  ReplaceRolePermissionsDto,
  ReplaceSubjectRolesDto,
  UpdateAuthorizationRoleDto,
} from '../dto/authorization-management.dto';
import {
  platformAuthorizationSqlConfigs,
  type PlatformAuthorizationSqlConfig,
} from '../management/platform-authorization-config';
import { type AuthorizationContext } from '../context/authorization-context';
import type {
  AuthorizationRoleDeletionResult,
  AuthorizationRoleSummary,
} from '../types/contracts/authorization-role.contract';
import type {
  AuthorizationMatrixPermission,
  AuthorizationMatrixResult,
} from '../types/contracts/authorization-matrix.contract';
import type {
  AuthorizationAuditResult,
  AuthorizationPlatformsResult,
  AuthorizationProviderMemberListResult,
} from '../types/contracts/authorization-management.contract';

type RoleRow = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  is_system: boolean;
  status: AuthorizationRoleStatus;
  version: number;
  permission_count: string | number;
  assignment_count: string | number;
  created_at: Date;
  updated_at: Date;
};

@Injectable()
/**
 * Legacy mutation kernel for authorization management.
 *
 * Feature services use this class for transaction boundaries, invariant locks,
 * audit writes, and mutation validation. Read endpoints use feature-owned
 * repositories directly.
 */
export class AuthorizationManagementCoreService {
  constructor(
    private readonly dataSource: DataSource,
    @Optional() private readonly auditService?: AuthorizationAuditService,
  ) {}

  platforms(): AuthorizationPlatformsResult {
    return {
      items: [
        {
          platform: AuthorizationPlatform.MARKETPLACE,
          displayName: 'Marketplace',
          subjectType: 'CUSTOMER',
          supportsRoles: true,
          supportsAssignments: true,
        },
        {
          platform: AuthorizationPlatform.PROVIDER,
          displayName: 'Provider',
          subjectType: 'PROVIDER_MEMBERSHIP',
          supportsRoles: true,
          supportsAssignments: true,
        },
        {
          platform: AuthorizationPlatform.ADMINISTRATION,
          displayName: 'Administration',
          subjectType: 'ADMINISTRATOR',
          supportsRoles: true,
          supportsAssignments: true,
        },
      ],
    };
  }

  /** Creates a custom role, validates platform ownership, and records one atomic audit event. */
  async createRole(
    context: AuthorizationContext,
    dto: CreateAuthorizationRoleDto,
    actorAdministratorId: string,
    requestId: string | null,
  ): Promise<string> {
    const { platform, config } = context;
    const code = this.normalizeRoleCode(dto.code);
    const permissionIds = [...new Set(dto.permissionIds ?? [])];
    try {
      const roleId = await this.dataSource.transaction(async (manager) => {
        const permissionRows = await this.validatePermissions(
          manager,
          config,
          platform,
          permissionIds,
        );
        const rows = await manager.query<{ id: string }[]>(
          `INSERT INTO ${config.roleTable} (code, name, description, is_system, status, version)
           VALUES ($1, $2, $3, false, 'ACTIVE', 1) RETURNING id`,
          [code, dto.name.trim(), dto.description?.trim() || null],
        );
        const id = rows[0].id;
        for (const permission of permissionRows) {
          await manager.query(
            `INSERT INTO ${config.rolePermissionTable} (role_id, permission_id) VALUES ($1, $2)`,
            [id, permission.id],
          );
        }
        await this.writeAudit(manager, {
          actorAdministratorId,
          platform,
          action: 'ROLE_CREATED',
          targetType: 'ROLE',
          targetId: id,
          requestId,
          beforeState: null,
          afterState: { code, name: dto.name.trim(), permissionIds },
          reason: null,
        });
        return id;
      });
      return roleId;
    } catch (error) {
      if (this.isUniqueViolation(error)) {
        throw new BusinessException(AuthorizationErrorCodes.ROLE_CODE_EXISTS, {
          code,
          platform,
        });
      }
      throw error;
    }
  }

  /** Updates role metadata with optimistic locking and post-mutation safety validation. */
  async updateRole(
    context: AuthorizationContext,
    roleId: string,
    dto: UpdateAuthorizationRoleDto,
    actorAdministratorId: string,
    requestId: string | null,
  ): Promise<string> {
    const { platform, config } = context;
    await this.dataSource.transaction(async (manager) => {
      // Serialize recovery-capability changes so two administrators cannot both
      // observe a safe state and then remove the final recovery path.
      if (platform === AuthorizationPlatform.ADMINISTRATION) {
        await this.lockAdministrationRecovery(manager);
      }
      await manager.query('SELECT pg_advisory_xact_lock(hashtext($1))', [
        `role:${platform}:${roleId}`,
      ]);
      const current = await this.findRole(config, roleId, manager);
      if (!current) {
        throw new BusinessException(AuthorizationErrorCodes.ROLE_NOT_FOUND, {
          roleId,
          platform,
        });
      }
      if (
        current.is_system &&
        dto.status !== undefined &&
        dto.status !== current.status
      ) {
        throw new BusinessException(
          AuthorizationErrorCodes.SYSTEM_ROLE_IMMUTABLE,
          { roleId },
        );
      }
      if (
        platform === AuthorizationPlatform.PROVIDER &&
        current.code === 'OWNER' &&
        dto.status === AuthorizationRoleStatus.DISABLED
      ) {
        throw new BusinessException(
          AuthorizationErrorCodes.SYSTEM_ROLE_IMMUTABLE,
          { roleId },
        );
      }
      if (
        platform === AuthorizationPlatform.PROVIDER &&
        current.code === 'OWNER'
      ) {
        await this.lockProviderOwner(manager, roleId);
      }
      const descriptionIsUnchanged = dto.description === undefined;
      const updateResult = (await manager.query<RoleRow[]>(
        `UPDATE ${config.roleTable}
         SET name = COALESCE($2::varchar, name),
             description = CASE WHEN $3::boolean THEN description ELSE $4::text END,
             status = COALESCE($5::varchar, status), version = version + 1,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $1 AND version = $6 AND deleted_at IS NULL
         RETURNING id, code, name, description, is_system, status, version, created_at, updated_at,
           0::bigint AS permission_count, 0::bigint AS assignment_count`,
        [
          roleId,
          dto.name?.trim() ?? null,
          descriptionIsUnchanged,
          dto.description?.trim() || null,
          dto.status ?? null,
          dto.expectedVersion,
        ],
      )) as unknown;
      const rows =
        Array.isArray(updateResult) && Array.isArray(updateResult[0])
          ? (updateResult[0] as RoleRow[])
          : [];
      const updatedRole = rows[0];
      if (!updatedRole) {
        throw new BusinessException(
          AuthorizationErrorCodes.ROLE_VERSION_CONFLICT,
          {
            roleId,
            expectedVersion: dto.expectedVersion,
            currentVersion: current.version,
          },
        );
      }
      await this.writeAudit(manager, {
        actorAdministratorId,
        platform,
        action:
          dto.status === AuthorizationRoleStatus.DISABLED
            ? 'ROLE_DISABLED'
            : 'ROLE_UPDATED',
        targetType: 'ROLE',
        targetId: roleId,
        requestId,
        beforeState: { ...this.roleSummary(current, platform) },
        afterState: { ...this.roleSummary(updatedRole, platform) },
        reason: null,
      });
      if (platform === AuthorizationPlatform.ADMINISTRATION) {
        await this.assertRecoveryCapability(manager);
      }
    });
    return roleId;
  }

  /** Soft-deletes an unused non-system role after checking platform invariants. */
  async deleteRole(
    context: AuthorizationContext,
    roleId: string,
    actorAdministratorId: string,
    requestId: string | null,
  ): Promise<AuthorizationRoleDeletionResult> {
    const { platform, config } = context;
    await this.dataSource.transaction(async (manager) => {
      if (platform === AuthorizationPlatform.ADMINISTRATION) {
        await this.lockAdministrationRecovery(manager);
      }
      await manager.query('SELECT pg_advisory_xact_lock(hashtext($1))', [
        `role:${platform}:${roleId}`,
      ]);
      const role = await this.findRole(config, roleId, manager);
      if (!role) {
        throw new BusinessException(AuthorizationErrorCodes.ROLE_NOT_FOUND, {
          roleId,
          platform,
        });
      }
      if (role.is_system || role.code === 'OWNER') {
        throw new BusinessException(
          AuthorizationErrorCodes.SYSTEM_ROLE_IMMUTABLE,
          { roleId },
        );
      }
      const usageRows = await manager.query<{ count: string }[]>(
        `SELECT COUNT(*)::text AS count FROM ${config.assignmentTable} WHERE role_id = $1`,
        [roleId],
      );
      const assignmentCount = Number(usageRows[0]?.count ?? 0);
      if (assignmentCount > 0) {
        throw new BusinessException(AuthorizationErrorCodes.ROLE_IN_USE, {
          roleId,
          assignmentCount,
        });
      }
      await manager.query(
        `UPDATE ${config.roleTable} SET deleted_at = CURRENT_TIMESTAMP, status = 'DISABLED', version = version + 1 WHERE id = $1`,
        [roleId],
      );
      await this.writeAudit(manager, {
        actorAdministratorId,
        platform,
        action: 'ROLE_DELETED',
        targetType: 'ROLE',
        targetId: roleId,
        requestId,
        beforeState: { ...this.roleSummary(role, platform) },
        afterState: { deletedAt: new Date().toISOString() },
        reason: null,
      });
      if (platform === AuthorizationPlatform.ADMINISTRATION) {
        await this.assertRecoveryCapability(manager);
      }
    });
    return { id: roleId, deleted: true };
  }

  /** Replaces a role's complete permission set and validates effective authority before commit. */
  async replaceRolePermissions(
    context: AuthorizationContext,
    roleId: string,
    dto: ReplaceRolePermissionsDto,
    actorAdministratorId: string,
    requestId: string | null,
  ): Promise<string> {
    const { platform, config } = context;
    const permissionIds = [...new Set(dto.permissionIds)];
    await this.dataSource.transaction(async (manager) => {
      if (platform === AuthorizationPlatform.ADMINISTRATION) {
        await this.lockAdministrationRecovery(manager);
      }
      await manager.query('SELECT pg_advisory_xact_lock(hashtext($1))', [
        `role:${platform}:${roleId}`,
      ]);
      const role = await this.findRole(config, roleId, manager);
      if (!role) {
        throw new BusinessException(AuthorizationErrorCodes.ROLE_NOT_FOUND, {
          roleId,
          platform,
        });
      }
      const beforeRows = await this.rolePermissionIds(config, roleId, manager);
      const permissionRows = await this.validatePermissions(
        manager,
        config,
        platform,
        permissionIds,
      );
      if (
        platform === AuthorizationPlatform.PROVIDER &&
        role.code === 'OWNER'
      ) {
        this.assertOwnerPermissions(permissionRows, roleId);
        await this.lockProviderOwner(manager, roleId);
      }
      const updateResult = (await manager.query<{ id: string }[]>(
        `UPDATE ${config.roleTable} SET version = version + 1, updated_at = CURRENT_TIMESTAMP
         WHERE id = $1 AND version = $2 AND deleted_at IS NULL RETURNING id`,
        [roleId, dto.expectedVersion],
      )) as unknown;
      const updated =
        Array.isArray(updateResult) && Array.isArray(updateResult[0])
          ? (updateResult[0] as { id: string }[])
          : [];
      if (!updated[0]) {
        throw new BusinessException(
          AuthorizationErrorCodes.ROLE_VERSION_CONFLICT,
          {
            roleId,
            expectedVersion: dto.expectedVersion,
            currentVersion: role.version,
          },
        );
      }
      await manager.query(
        `DELETE FROM ${config.rolePermissionTable} WHERE role_id = $1`,
        [roleId],
      );
      for (const permissionId of permissionIds) {
        await manager.query(
          `INSERT INTO ${config.rolePermissionTable} (role_id, permission_id) VALUES ($1, $2)`,
          [roleId, permissionId],
        );
      }
      await this.writeAudit(manager, {
        actorAdministratorId,
        platform,
        action: 'ROLE_PERMISSIONS_REPLACED',
        targetType: 'ROLE',
        targetId: roleId,
        requestId,
        beforeState: { permissionIds: beforeRows },
        afterState: { permissionIds },
        reason: null,
      });
      if (platform === AuthorizationPlatform.ADMINISTRATION) {
        await this.assertRecoveryCapability(manager);
      }
      if (
        platform === AuthorizationPlatform.PROVIDER &&
        role.code === 'OWNER'
      ) {
        await this.assertProviderOwnerRole(manager, roleId);
      }
    });
    return roleId;
  }

  /** Builds the normalized role-permission matrix with deterministic ordering. */
  async matrix(
    context: AuthorizationContext,
  ): Promise<AuthorizationMatrixResult> {
    const { config } = context;
    const roles = await this.dataSource.query<
      { id: string; code: string; name: string }[]
    >(
      `SELECT id, code, name FROM ${config.roleTable} WHERE deleted_at IS NULL ORDER BY code, id`,
    );
    const permissions = await this.dataSource.query<PermissionRow[]>(
      `SELECT id, code, name, description, category, resource, action, risk_level, is_assignable, deprecated_at, created_at, updated_at
       FROM ${config.permissionTable} WHERE deleted_at IS NULL AND deprecated_at IS NULL ORDER BY category, code, id`,
    );
    const mappings = await this.dataSource.query<
      { role_id: string; permission_id: string }[]
    >(
      `SELECT role_id, permission_id FROM ${config.rolePermissionTable} ORDER BY role_id, permission_id`,
    );
    const permissionGroups = new Map<string, AuthorizationMatrixPermission[]>();
    for (const permission of permissions) {
      const group = permissionGroups.get(permission.category) ?? [];
      group.push({
        id: permission.id,
        code: permission.code,
        name: permission.name,
        riskLevel: permission.risk_level,
      });
      permissionGroups.set(permission.category, group);
    }
    const assignments: Record<string, string[]> = {};
    for (const role of roles) assignments[role.id] = [];
    for (const mapping of mappings)
      assignments[mapping.role_id]?.push(mapping.permission_id);
    return {
      roles,
      permissionGroups: [...permissionGroups.entries()].map(
        ([category, permissionItems]) => ({
          category,
          permissions: permissionItems,
        }),
      ),
      assignments,
    };
  }

  /** Replaces one subject's complete role set and protects affected recovery/owner invariants. */
  async replaceSubjectRoles(
    context: AuthorizationContext,
    subjectId: string,
    dto: ReplaceSubjectRolesDto,
    actorAdministratorId: string,
    requestId: string | null,
  ): Promise<string> {
    const { platform, config } = context;
    const roleIds = [...new Set(dto.roleIds)];
    await this.dataSource.transaction(async (manager) => {
      if (platform === AuthorizationPlatform.ADMINISTRATION) {
        await this.lockAdministrationRecovery(manager);
      }
      await manager.query('SELECT pg_advisory_xact_lock(hashtext($1))', [
        `subject:${platform}:${subjectId}`,
      ]);
      const subject = await this.subjectExists(config, subjectId, manager);
      if (!subject) {
        throw new BusinessException(AuthorizationErrorCodes.SUBJECT_NOT_FOUND, {
          subjectId,
          platform,
        });
      }
      const roleRows = await this.validateRoleIds(
        manager,
        config,
        platform,
        roleIds,
      );
      if (
        roleRows.some((role) => role.status !== AuthorizationRoleStatus.ACTIVE)
      ) {
        throw new BusinessException(
          AuthorizationErrorCodes.ASSIGNMENT_CONFLICT,
          { reason: 'disabled_role', roleIds },
        );
      }
      let providerId: string | undefined;
      if (platform === AuthorizationPlatform.PROVIDER) {
        const membershipRows = await manager.query<{ provider_id: string }[]>(
          `SELECT provider_id FROM tbl_provider_membership
           WHERE id = $1 AND deleted_at IS NULL FOR UPDATE`,
          [subjectId],
        );
        providerId = membershipRows[0]?.provider_id;
        if (providerId) {
          await manager.query('SELECT pg_advisory_xact_lock(hashtext($1))', [
            `provider:last-owner-protection:${providerId}`,
          ]);
        }
      }
      const beforeRoleIds = await this.roleIds(config, subjectId, manager);
      await manager.query(
        `DELETE FROM ${config.assignmentTable} WHERE ${config.assignmentSubjectColumn} = $1`,
        [subjectId],
      );
      for (const roleId of roleIds) {
        const assignedByColumn =
          platform === AuthorizationPlatform.ADMINISTRATION
            ? 'assigned_by_admin_id'
            : 'assigned_by_admin_id';
        await manager.query(
          `INSERT INTO ${config.assignmentTable} (${config.assignmentSubjectColumn}, role_id, assigned_at, ${assignedByColumn}) VALUES ($1, $2, CURRENT_TIMESTAMP, $3)`,
          [subjectId, roleId, actorAdministratorId],
        );
      }
      if (platform === AuthorizationPlatform.ADMINISTRATION) {
        await this.assertRecoveryCapability(manager);
      }
      if (platform === AuthorizationPlatform.PROVIDER) {
        await this.assertProviderOwnerMembership(
          manager,
          providerId,
          roleIds,
          subjectId,
        );
      }
      await this.writeAudit(manager, {
        actorAdministratorId,
        platform,
        action: 'SUBJECT_ROLES_REPLACED',
        targetType: config.subjectType,
        targetId: subjectId,
        requestId,
        beforeState: { roleIds: beforeRoleIds },
        afterState: { roleIds },
        reason: dto.reason ?? null,
      });
    });
    return subjectId;
  }

  /** Returns paginated authorization audit records with bounded, safe filters. */
  async audit(
    query: AuthorizationAuditQueryDto,
  ): Promise<AuthorizationAuditResult> {
    const pagination = PaginationHelper.normalize(query);
    const where: string[] = ['1 = 1'];
    const parameters: unknown[] = [];
    for (const [column, value] of [
      ['platform', query.platform],
      ['actor_administrator_id', query.actorAdministratorId],
      ['action', query.action],
      ['target_type', query.targetType],
      ['target_id', query.targetId],
    ] as const) {
      if (value) {
        parameters.push(value);
        where.push(`audit.${column} = $${parameters.length}`);
      }
    }
    if (query.from) {
      parameters.push(query.from);
      where.push(`audit.created_at >= $${parameters.length}`);
    }
    if (query.to) {
      parameters.push(query.to);
      where.push(`audit.created_at <= $${parameters.length}`);
    }
    const whereSql = where.join(' AND ');
    const offset = (pagination.page - 1) * pagination.limit;
    const countRows = await this.dataSource.query<{ total: string }[]>(
      `SELECT COUNT(*)::text AS total FROM tbl_authorization_audit_log audit WHERE ${whereSql}`,
      parameters,
    );
    const rows = await this.dataSource.query<AuditRow[]>(
      `SELECT id, actor_administrator_id, platform, action, target_type, target_id, reason, before_state, after_state, request_id, created_at FROM tbl_authorization_audit_log audit WHERE ${whereSql} ORDER BY audit.created_at DESC, audit.id DESC LIMIT ${pagination.limit} OFFSET ${offset}`,
      parameters,
    );
    return PaginationHelper.buildMeta(
      rows.map((row) => ({
        id: row.id,
        actorAdministratorId: row.actor_administrator_id,
        platform: row.platform,
        action: row.action,
        targetType: row.target_type,
        targetId: row.target_id,
        reason: row.reason,
        beforeState: row.before_state,
        afterState: row.after_state,
        requestId: row.request_id,
        createdAt: row.created_at,
      })),
      Number(countRows[0]?.total ?? 0),
      pagination,
    );
  }

  /** Lists provider memberships with explicit provider context and role usage data. */
  async providerMembers(
    providerId: string,
    query: AuthorizationSubjectListQueryDto,
  ): Promise<AuthorizationProviderMemberListResult> {
    const pagination = PaginationHelper.normalize(query);
    const parameters: unknown[] = [providerId];
    const where = [
      'membership.provider_id = $1',
      'membership.deleted_at IS NULL',
    ];
    if (query.q) {
      parameters.push(`%${query.q.trim()}%`);
      where.push(
        `(customer.email ILIKE $${parameters.length} OR membership.id::text ILIKE $${parameters.length})`,
      );
    }
    if (query.status) {
      parameters.push(query.status);
      where.push(`membership.status = $${parameters.length}`);
    }
    const whereSql = where.join(' AND ');
    const offset = (pagination.page - 1) * pagination.limit;
    const countRows = await this.dataSource.query<{ total: string }[]>(
      `SELECT COUNT(*)::text AS total FROM tbl_provider_membership membership
       INNER JOIN tbl_customer_account customer ON customer.id = membership.customer_id
       WHERE ${whereSql}`,
      parameters,
    );
    const rows = await this.dataSource.query<ProviderMemberRow[]>(
      `SELECT membership.id, membership.provider_id, membership.customer_id,
              membership.status, membership.joined_at, customer.email,
              COALESCE(array_agg(role.code) FILTER (WHERE role.id IS NOT NULL), ARRAY[]::text[]) AS role_codes
       FROM tbl_provider_membership membership
       INNER JOIN tbl_customer_account customer ON customer.id = membership.customer_id
       LEFT JOIN tbl_provider_membership_role assignment ON assignment.membership_id = membership.id
       LEFT JOIN tbl_provider_role role ON role.id = assignment.role_id AND role.deleted_at IS NULL
       WHERE ${whereSql}
       GROUP BY membership.id, customer.email
       ORDER BY customer.email, membership.id
       LIMIT ${pagination.limit} OFFSET ${offset}`,
      parameters,
    );
    return PaginationHelper.buildMeta(
      rows.map((row) => ({
        id: row.id,
        providerId: row.provider_id,
        customerId: row.customer_id,
        status: row.status,
        joinedAt: row.joined_at,
        customerEmail: row.email,
        roleCodes: row.role_codes,
      })),
      Number(countRows[0]?.total ?? 0),
      pagination,
    );
  }

  private async findRole(
    config: PlatformAuthorizationSqlConfig,
    id: string,
    manager?: EntityManager,
  ): Promise<RoleRow | null> {
    const executor = manager ?? this.dataSource;
    const rows = await executor.query<RoleRow[]>(
      `SELECT role.id, role.code, role.name, role.description, role.is_system, role.status, role.version, role.created_at, role.updated_at,
              (SELECT COUNT(*) FROM ${config.rolePermissionTable} mapping WHERE mapping.role_id = role.id) AS permission_count,
              (SELECT COUNT(*) FROM ${config.assignmentTable} assignment WHERE assignment.role_id = role.id) AS assignment_count
       FROM ${config.roleTable} role WHERE role.id = $1 AND role.deleted_at IS NULL`,
      [id],
    );
    return rows[0] ?? null;
  }

  private async roleIds(
    config: PlatformAuthorizationSqlConfig,
    subjectId: string,
    manager?: EntityManager,
  ): Promise<string[]> {
    const executor = manager ?? this.dataSource;
    const rows = await executor.query<{ role_id: string }[]>(
      `SELECT role_id FROM ${config.assignmentTable} WHERE ${config.assignmentSubjectColumn} = $1 ORDER BY role_id`,
      [subjectId],
    );
    return rows.map((row) => row.role_id);
  }

  private async rolePermissionIds(
    config: PlatformAuthorizationSqlConfig,
    roleId: string,
    manager?: EntityManager,
  ): Promise<string[]> {
    const executor = manager ?? this.dataSource;
    const rows = await executor.query<{ permission_id: string }[]>(
      `SELECT permission_id FROM ${config.rolePermissionTable} WHERE role_id = $1 ORDER BY permission_id`,
      [roleId],
    );
    return rows.map((row) => row.permission_id);
  }

  private async subjectExists(
    config: PlatformAuthorizationSqlConfig,
    id: string,
    manager?: EntityManager,
  ): Promise<boolean> {
    const executor = manager ?? this.dataSource;
    const rows = await executor.query<{ id: string }[]>(
      `SELECT id FROM ${config.subjectTable} subject WHERE subject.id = $1 AND subject.deleted_at IS NULL`,
      [id],
    );
    return Boolean(rows[0]);
  }

  private async validatePermissions(
    manager: EntityManager,
    config: PlatformAuthorizationSqlConfig,
    platform: AuthorizationPlatform,
    ids: string[],
  ) {
    if (ids.length === 0) return [] as PermissionRow[];
    const rows = await manager.query<PermissionRow[]>(
      `SELECT id, code, name, description, category, resource, action, risk_level, is_assignable, deprecated_at, created_at, updated_at
       FROM ${config.permissionTable} WHERE id = ANY($1::uuid[]) AND deleted_at IS NULL`,
      [ids],
    );
    if (rows.length !== ids.length) {
      const otherTables = platformAuthorizationSqlConfigs
        .filter(
          (candidate) => candidate.permissionTable !== config.permissionTable,
        )
        .map((candidate) => candidate.permissionTable);
      const crossRows: { id: string }[] = [];
      for (const table of otherTables) {
        const matches = await manager.query<{ id: string }[]>(
          `SELECT id FROM ${table} WHERE id = ANY($1::uuid[]) AND deleted_at IS NULL`,
          [ids],
        );
        crossRows.push(...matches);
      }
      if (crossRows.length > 0) {
        throw new BusinessException(
          AuthorizationErrorCodes.PERMISSION_PLATFORM_MISMATCH,
          { platform, permissionIds: crossRows.map((row) => row.id) },
        );
      }
      const known = new Set(rows.map((row) => row.id));
      throw new BusinessException(
        AuthorizationErrorCodes.PERMISSION_NOT_FOUND,
        { permissionIds: ids.filter((id) => !known.has(id)), platform },
      );
    }
    const invalid = rows.filter(
      (row) => !row.is_assignable || row.deprecated_at,
    );
    if (invalid.length > 0) {
      throw new BusinessException(
        AuthorizationErrorCodes.PERMISSION_NOT_ASSIGNABLE,
        { permissionIds: invalid.map((row) => row.id), platform },
      );
    }
    return rows;
  }

  private async validateRoleIds(
    manager: EntityManager,
    config: PlatformAuthorizationSqlConfig,
    platform: AuthorizationPlatform,
    ids: string[],
  ) {
    if (ids.length === 0) return [] as RoleRow[];
    const rows = await manager.query<RoleRow[]>(
      `SELECT id, code, name, description, is_system, status, version, created_at, updated_at, 0::bigint AS permission_count, 0::bigint AS assignment_count FROM ${config.roleTable} WHERE id = ANY($1::uuid[]) AND deleted_at IS NULL`,
      [ids],
    );
    if (rows.length !== ids.length) {
      const known = new Set(rows.map((row) => row.id));
      const otherTables = platformAuthorizationSqlConfigs
        .filter((candidate) => candidate.roleTable !== config.roleTable)
        .map((candidate) => candidate.roleTable);
      const crossRows: { id: string }[] = [];
      for (const table of otherTables) {
        const matches = await manager.query<{ id: string }[]>(
          `SELECT id FROM ${table} WHERE id = ANY($1::uuid[]) AND deleted_at IS NULL`,
          [ids],
        );
        crossRows.push(...matches);
      }
      if (crossRows.length > 0) {
        throw new BusinessException(
          AuthorizationErrorCodes.ROLE_PLATFORM_MISMATCH,
          { roleIds: crossRows.map((row) => row.id), platform },
        );
      }
      throw new BusinessException(AuthorizationErrorCodes.ROLE_NOT_FOUND, {
        roleIds: ids.filter((id) => !known.has(id)),
        platform,
      });
    }
    return rows;
  }

  private async lockAdministrationRecovery(manager: EntityManager) {
    await manager.query(
      `SELECT pg_advisory_xact_lock(hashtext('authorization:last-admin-protection'))`,
    );
  }

  private async assertRecoveryCapability(
    manager: EntityManager,
  ): Promise<void> {
    const rows = await manager.query<{ count: string }[]>(
      `SELECT COUNT(*)::text AS count
       FROM (
         SELECT assignment.administrator_id
         FROM tbl_administrator_role_assignment assignment
         INNER JOIN tbl_administration_role role ON role.id = assignment.role_id
         INNER JOIN tbl_administration_role_permission mapping ON mapping.role_id = role.id
         INNER JOIN tbl_administration_permission permission ON permission.id = mapping.permission_id
         INNER JOIN tbl_administrator_account administrator ON administrator.id = assignment.administrator_id
         WHERE administrator.is_active = true
           AND administrator.deleted_at IS NULL
           AND role.status = 'ACTIVE'
           AND role.deleted_at IS NULL
           AND permission.deleted_at IS NULL
           AND permission.deprecated_at IS NULL
           AND permission.code = ANY($1::text[])
         GROUP BY assignment.administrator_id
         HAVING COUNT(DISTINCT permission.code) = $2
       ) recovery_admins`,
      [
        AUTHORIZATION_RECOVERY_PERMISSIONS,
        AUTHORIZATION_RECOVERY_PERMISSIONS.length,
      ],
    );
    if (Number(rows[0]?.count ?? 0) === 0) {
      throw new BusinessException(
        AuthorizationErrorCodes.LAST_ADMIN_PROTECTION,
      );
    }
  }

  private async lockProviderOwner(
    manager: EntityManager,
    roleId: string,
  ): Promise<void> {
    const rows = await manager.query<{ provider_id: string }[]>(
      `SELECT provider_id FROM tbl_provider_membership_role assignment
       INNER JOIN tbl_provider_membership membership ON membership.id = assignment.membership_id
       WHERE assignment.role_id = $1
       GROUP BY membership.provider_id
       ORDER BY membership.provider_id`,
      [roleId],
    );
    for (const row of rows) {
      await manager.query('SELECT pg_advisory_xact_lock(hashtext($1))', [
        `provider:last-owner-protection:${row.provider_id}`,
      ]);
    }
  }

  private assertOwnerPermissions(
    permissionRows: PermissionRow[],
    roleId: string,
  ): void {
    const codes = new Set(permissionRows.map((permission) => permission.code));
    const required = ['provider-account:read', 'provider-account:update'];
    if (required.some((code) => !codes.has(code))) {
      throw new BusinessException(
        AuthorizationErrorCodes.PROVIDER_OWNER_PROTECTION,
        { roleId, requiredPermissions: required },
      );
    }
  }

  private async assertProviderOwnerRole(
    manager: EntityManager,
    roleId: string,
  ): Promise<void> {
    const rows = await manager.query<{ code: string; status: string }[]>(
      `SELECT code, status FROM tbl_provider_role
       WHERE id = $1 AND deleted_at IS NULL`,
      [roleId],
    );
    const role = rows[0];
    if (!role || role.code !== 'OWNER' || role.status !== 'ACTIVE') {
      throw new BusinessException(
        AuthorizationErrorCodes.PROVIDER_OWNER_PROTECTION,
        { roleId },
      );
    }
  }

  private async assertProviderOwnerMembership(
    manager: EntityManager,
    providerId: string | undefined,
    roleIds: string[],
    subjectId: string,
  ): Promise<void> {
    if (!providerId) return;
    const ownerRows = await manager.query<{ id: string }[]>(
      `SELECT id FROM tbl_provider_role
       WHERE code = 'OWNER' AND status = 'ACTIVE' AND deleted_at IS NULL`,
    );
    const ownerRoleId = ownerRows[0]?.id;
    if (!ownerRoleId || roleIds.includes(ownerRoleId)) return;

    const countRows = await manager.query<{ count: string }[]>(
      `SELECT COUNT(DISTINCT assignment.membership_id)::text AS count
       FROM tbl_provider_membership_role assignment
       INNER JOIN tbl_provider_membership membership ON membership.id = assignment.membership_id
       INNER JOIN tbl_provider_role role ON role.id = assignment.role_id
       WHERE membership.provider_id = $1
         AND membership.status = 'ACTIVE'
         AND membership.deleted_at IS NULL
         AND role.id = $2
         AND role.status = 'ACTIVE'
         AND role.deleted_at IS NULL`,
      [providerId, ownerRoleId],
    );
    if (Number(countRows[0]?.count ?? 0) === 0) {
      throw new BusinessException(
        AuthorizationErrorCodes.PROVIDER_LAST_OWNER_PROTECTION,
        { providerId, subjectId },
      );
    }
  }

  private async writeAudit(
    manager: EntityManager | DataSource,
    event: AuthorizationAuditEvent,
  ): Promise<void> {
    if (this.auditService) {
      await this.auditService.record(manager, event);
      return;
    }
    await manager.query(
      `INSERT INTO tbl_authorization_audit_log
        (actor_administrator_id, platform, action, target_type, target_id, reason, before_state, after_state, request_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb, $9)`,
      [
        event.actorAdministratorId,
        event.platform,
        event.action,
        event.targetType,
        event.targetId,
        event.reason,
        event.beforeState ? JSON.stringify(event.beforeState) : null,
        event.afterState ? JSON.stringify(event.afterState) : null,
        event.requestId,
      ],
    );
  }

  private roleSummary(
    row: RoleRow,
    platform?: AuthorizationPlatform,
  ): AuthorizationRoleSummary {
    const isProviderOwner =
      platform === AuthorizationPlatform.PROVIDER && row.code === 'OWNER';
    const allowedActions = {
      updateMetadata: true,
      updateStatus: !row.is_system && !isProviderOwner,
      updatePermissions: true,
      delete:
        !row.is_system &&
        !isProviderOwner &&
        Number(row.assignment_count ?? 0) === 0,
    };
    return {
      id: row.id,
      code: row.code,
      name: row.name,
      description: row.description,
      isSystem: row.is_system,
      status: row.status,
      version: row.version,
      permissionCount: Number(row.permission_count ?? 0),
      assignmentCount: Number(row.assignment_count ?? 0),
      allowedActions,
      isEditable: allowedActions.updateMetadata,
      isDeletable: allowedActions.delete,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private permissionSummary(
    row: PermissionRow,
    platform: AuthorizationPlatform,
  ) {
    return {
      id: row.id,
      code: row.code,
      name: row.name,
      description: row.description,
      platform,
      category: row.category,
      resource: row.resource,
      action: row.action,
      riskLevel: row.risk_level,
      isAssignable: row.is_assignable,
      isDeprecated: Boolean(row.deprecated_at),
      deprecatedAt: row.deprecated_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private normalizeRoleCode(code: string): string {
    const normalized = code.trim().toUpperCase();
    if (!/^[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)*$/.test(normalized)) {
      throw new BusinessException(AuthorizationErrorCodes.ASSIGNMENT_CONFLICT, {
        reason: 'invalid_role_code',
      });
    }
    return normalized;
  }

  private isUniqueViolation(error: unknown): boolean {
    return Boolean(
      error &&
      typeof error === 'object' &&
      'driverError' in error &&
      (error as { driverError?: { code?: string } }).driverError?.code ===
        '23505',
    );
  }
}

type PermissionRow = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  category: string;
  resource: string;
  action: string;
  risk_level: AuthorizationRiskLevel;
  is_assignable: boolean;
  deprecated_at: Date | null;
  created_at: Date;
  updated_at: Date;
};

type AuditRow = {
  id: string;
  actor_administrator_id: string;
  platform: AuthorizationPlatform;
  action: string;
  target_type: string;
  target_id: string | null;
  reason: string | null;
  before_state: Record<string, unknown> | null;
  after_state: Record<string, unknown> | null;
  request_id: string | null;
  created_at: Date;
};

type ProviderMemberRow = {
  id: string;
  provider_id: string;
  customer_id: string;
  status: string;
  joined_at: Date;
  email: string;
  role_codes: string[];
};
