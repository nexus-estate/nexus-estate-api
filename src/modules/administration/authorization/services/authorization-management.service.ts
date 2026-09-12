import { Injectable } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';

import { BusinessException } from '../../../../common/exceptions/business.exception';
import { PaginationHelper } from '../../../../utils/helpers/pagination.helper';
import { AuthorizationErrorCodes } from '../errors/authorization-error-codes';
import { ADMINISTRATION_PERMISSIONS } from '../constants/administration-permission.constant';
import {
  AuthorizationPlatform,
  AuthorizationRoleStatus,
} from '../enums/authorization-platform.enum';
import type {
  AuthorizationAuditQueryDto,
  AuthorizationPermissionListQueryDto,
  AuthorizationRoleListQueryDto,
  AuthorizationSubjectListQueryDto,
  CreateAuthorizationRoleDto,
  ReplaceRolePermissionsDto,
  ReplaceSubjectRolesDto,
  UpdateAuthorizationRoleDto,
} from '../dto/authorization-management.dto';

type PlatformConfig = {
  roleTable: string;
  permissionTable: string;
  rolePermissionTable: string;
  assignmentTable: string;
  assignmentSubjectColumn: string;
  subjectTable: string;
  subjectType: 'CUSTOMER' | 'PROVIDER_MEMBERSHIP' | 'ADMINISTRATOR';
};

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

const CONFIGS: Record<AuthorizationPlatform, PlatformConfig> = {
  [AuthorizationPlatform.MARKETPLACE]: {
    roleTable: 'tbl_marketplace_role',
    permissionTable: 'tbl_marketplace_permission',
    rolePermissionTable: 'tbl_marketplace_role_permission',
    assignmentTable: 'tbl_customer_role_assignment',
    assignmentSubjectColumn: 'customer_id',
    subjectTable: 'tbl_customer_account',
    subjectType: 'CUSTOMER',
  },
  [AuthorizationPlatform.PROVIDER]: {
    roleTable: 'tbl_provider_role',
    permissionTable: 'tbl_provider_permission',
    rolePermissionTable: 'tbl_provider_role_permission',
    assignmentTable: 'tbl_provider_membership_role',
    assignmentSubjectColumn: 'membership_id',
    subjectTable: 'tbl_provider_membership',
    subjectType: 'PROVIDER_MEMBERSHIP',
  },
  [AuthorizationPlatform.ADMINISTRATION]: {
    roleTable: 'tbl_administration_role',
    permissionTable: 'tbl_administration_permission',
    rolePermissionTable: 'tbl_administration_role_permission',
    assignmentTable: 'tbl_administrator_role_assignment',
    assignmentSubjectColumn: 'administrator_id',
    subjectTable: 'tbl_administrator_account',
    subjectType: 'ADMINISTRATOR',
  },
};

const ROLE_SORT_COLUMNS: Record<string, string> = {
  name: 'role.name',
  code: 'role.code',
  createdAt: 'role.created_at',
  updatedAt: 'role.updated_at',
  assignmentCount: 'assignment_count',
  permissionCount: 'permission_count',
};

const PERMISSION_SORT_COLUMNS: Record<string, string> = {
  name: 'permission.name',
  code: 'permission.code',
  category: 'permission.category',
  resource: 'permission.resource',
  action: 'permission.action',
  createdAt: 'permission.created_at',
  updatedAt: 'permission.updated_at',
};

@Injectable()
export class AuthorizationManagementService {
  constructor(private readonly dataSource: DataSource) {}

  platforms() {
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

  async listRoles(
    platform: AuthorizationPlatform,
    query: AuthorizationRoleListQueryDto,
  ) {
    const config = this.config(platform);
    const pagination = PaginationHelper.normalize(query);
    const where: string[] = ['role.deleted_at IS NULL'];
    const parameters: unknown[] = [];
    if (query.q) {
      parameters.push(`%${query.q.trim()}%`);
      where.push(
        `(role.code ILIKE $${parameters.length} OR role.name ILIKE $${parameters.length} OR COALESCE(role.description, '') ILIKE $${parameters.length})`,
      );
    }
    if (query.status) {
      parameters.push(query.status);
      where.push(`role.status = $${parameters.length}`);
    }
    if (query.isSystem !== undefined) {
      parameters.push(query.isSystem);
      where.push(`role.is_system = $${parameters.length}`);
    }
    if (query.permissionCode) {
      parameters.push(query.permissionCode.trim());
      where.push(`EXISTS (
        SELECT 1 FROM ${config.rolePermissionTable} filter_mapping
        INNER JOIN ${config.permissionTable} filter_permission
          ON filter_permission.id = filter_mapping.permission_id
        WHERE filter_mapping.role_id = role.id
          AND filter_permission.code = $${parameters.length}
          AND filter_permission.deleted_at IS NULL
      )`);
    }
    const whereSql = where.join(' AND ');
    const orderBy = ROLE_SORT_COLUMNS[query.sort ?? 'name'] ?? 'role.name';
    const order = query.order === 'desc' ? 'DESC' : 'ASC';
    const offset = (pagination.page - 1) * pagination.limit;
    const countRows = await this.dataSource.query<{ total: string }[]>(
      `SELECT COUNT(*)::text AS total FROM ${config.roleTable} role WHERE ${whereSql}`,
      parameters,
    );
    const rows = await this.dataSource.query<RoleRow[]>(
      `
        SELECT role.id, role.code, role.name, role.description,
               role.is_system, role.status, role.version,
               role.created_at, role.updated_at,
               (SELECT COUNT(*) FROM ${config.rolePermissionTable} mapping WHERE mapping.role_id = role.id) AS permission_count,
               (SELECT COUNT(*) FROM ${config.assignmentTable} assignment WHERE assignment.role_id = role.id) AS assignment_count
        FROM ${config.roleTable} role
        WHERE ${whereSql}
        ORDER BY ${orderBy} ${order}, role.id ASC
        LIMIT ${pagination.limit} OFFSET ${offset}
      `,
      parameters,
    );
    const total = Number(countRows[0]?.total ?? 0);
    return PaginationHelper.buildMeta(
      rows.map((row) => this.roleSummary(row)),
      total,
      pagination,
    );
  }

  async getRole(platform: AuthorizationPlatform, roleId: string) {
    const config = this.config(platform);
    const role = await this.findRole(config, roleId);
    if (!role) {
      throw new BusinessException(AuthorizationErrorCodes.ROLE_NOT_FOUND, {
        roleId,
        platform,
      });
    }
    const permissions = await this.dataSource.query<PermissionRow[]>(
      `
        SELECT permission.id, permission.code, permission.name,
               permission.description, permission.category,
               permission.resource, permission.action, permission.risk_level,
               permission.is_assignable, permission.deprecated_at,
               permission.created_at, permission.updated_at
        FROM ${config.permissionTable} permission
        INNER JOIN ${config.rolePermissionTable} mapping
          ON mapping.permission_id = permission.id
        WHERE mapping.role_id = $1 AND permission.deleted_at IS NULL
        ORDER BY permission.category ASC, permission.code ASC
      `,
      [roleId],
    );
    return {
      ...this.roleSummary(role),
      permissions: permissions.map((permission) =>
        this.permissionSummary(permission, platform),
      ),
    };
  }

  async createRole(
    platform: AuthorizationPlatform,
    dto: CreateAuthorizationRoleDto,
    actorAdministratorId: string,
    requestId: string | null,
  ) {
    const config = this.config(platform);
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
      return this.getRole(platform, roleId);
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

  async updateRole(
    platform: AuthorizationPlatform,
    roleId: string,
    dto: UpdateAuthorizationRoleDto,
    actorAdministratorId: string,
    requestId: string | null,
  ) {
    const config = this.config(platform);
    await this.dataSource.transaction(async (manager) => {
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
      const rows = await manager.query<RoleRow[]>(
        `UPDATE ${config.roleTable}
         SET name = COALESCE($2, name), description = ${dto.description === undefined ? 'description' : '$3'},
             status = COALESCE($4, status), version = version + 1, updated_at = CURRENT_TIMESTAMP
         WHERE id = $1 AND version = $5 AND deleted_at IS NULL
         RETURNING id, code, name, description, is_system, status, version, created_at, updated_at,
           0::bigint AS permission_count, 0::bigint AS assignment_count`,
        [
          roleId,
          dto.name?.trim() ?? null,
          dto.description === undefined
            ? null
            : dto.description?.trim() || null,
          dto.status ?? null,
          dto.expectedVersion,
        ],
      );
      if (!rows[0]) {
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
        beforeState: this.roleSummary(current),
        afterState: this.roleSummary(rows[0]),
        reason: null,
      });
    });
    return this.getRole(platform, roleId);
  }

  async deleteRole(
    platform: AuthorizationPlatform,
    roleId: string,
    actorAdministratorId: string,
    requestId: string | null,
  ) {
    const config = this.config(platform);
    await this.dataSource.transaction(async (manager) => {
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
      if (role.is_system) {
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
        beforeState: this.roleSummary(role),
        afterState: { deletedAt: new Date().toISOString() },
        reason: null,
      });
    });
    return { id: roleId, deleted: true };
  }

  async replaceRolePermissions(
    platform: AuthorizationPlatform,
    roleId: string,
    dto: ReplaceRolePermissionsDto,
    actorAdministratorId: string,
    requestId: string | null,
  ) {
    const config = this.config(platform);
    const permissionIds = [...new Set(dto.permissionIds)];
    await this.dataSource.transaction(async (manager) => {
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
      await this.validatePermissions(manager, config, platform, permissionIds);
      const updated = await manager.query<{ id: string }[]>(
        `UPDATE ${config.roleTable} SET version = version + 1, updated_at = CURRENT_TIMESTAMP
         WHERE id = $1 AND version = $2 AND deleted_at IS NULL RETURNING id`,
        [roleId, dto.expectedVersion],
      );
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
    });
    return this.getRole(platform, roleId);
  }

  async listPermissions(
    platform: AuthorizationPlatform,
    query: AuthorizationPermissionListQueryDto,
  ) {
    const config = this.config(platform);
    const pagination = PaginationHelper.normalize(query);
    const where: string[] = ['permission.deleted_at IS NULL'];
    const parameters: unknown[] = [];
    if (query.q) {
      parameters.push(`%${query.q.trim()}%`);
      where.push(
        `(permission.code ILIKE $${parameters.length} OR permission.name ILIKE $${parameters.length} OR permission.description ILIKE $${parameters.length})`,
      );
    }
    for (const [field, value] of [
      ['category', query.category],
      ['resource', query.resource],
      ['action', query.action],
      ['risk_level', query.riskLevel],
    ] as const) {
      if (value) {
        parameters.push(value);
        where.push(`permission.${field} = $${parameters.length}`);
      }
    }
    if (query.isAssignable !== undefined) {
      parameters.push(query.isAssignable);
      where.push(`permission.is_assignable = $${parameters.length}`);
    }
    if (!query.includeDeprecated) {
      where.push('permission.deprecated_at IS NULL');
    }
    const orderBy =
      PERMISSION_SORT_COLUMNS[query.sort ?? 'category'] ??
      'permission.category';
    const order = query.order === 'desc' ? 'DESC' : 'ASC';
    const offset = (pagination.page - 1) * pagination.limit;
    const whereSql = where.join(' AND ');
    const countRows = await this.dataSource.query<{ total: string }[]>(
      `SELECT COUNT(*)::text AS total FROM ${config.permissionTable} permission WHERE ${whereSql}`,
      parameters,
    );
    const rows = await this.dataSource.query<PermissionRow[]>(
      `SELECT permission.id, permission.code, permission.name, permission.description,
              permission.category, permission.resource, permission.action,
              permission.risk_level, permission.is_assignable, permission.deprecated_at,
              permission.created_at, permission.updated_at
       FROM ${config.permissionTable} permission WHERE ${whereSql}
       ORDER BY ${orderBy} ${order}, permission.id ASC
       LIMIT ${pagination.limit} OFFSET ${offset}`,
      parameters,
    );
    return PaginationHelper.buildMeta(
      rows.map((row) => this.permissionSummary(row, platform)),
      Number(countRows[0]?.total ?? 0),
      pagination,
    );
  }

  async getPermission(platform: AuthorizationPlatform, permissionId: string) {
    const config = this.config(platform);
    const rows = await this.dataSource.query<PermissionRow[]>(
      `SELECT id, code, name, description, category, resource, action,
              risk_level, is_assignable, deprecated_at, created_at, updated_at
       FROM ${config.permissionTable} WHERE id = $1 AND deleted_at IS NULL`,
      [permissionId],
    );
    const permission = rows[0];
    if (!permission) {
      throw new BusinessException(
        AuthorizationErrorCodes.PERMISSION_NOT_FOUND,
        { permissionId, platform },
      );
    }
    const rolesUsing = await this.dataSource.query<
      { id: string; code: string; name: string }[]
    >(
      `SELECT role.id, role.code, role.name FROM ${config.roleTable} role
       INNER JOIN ${config.rolePermissionTable} mapping ON mapping.role_id = role.id
       WHERE mapping.permission_id = $1 AND role.deleted_at IS NULL ORDER BY role.code`,
      [permissionId],
    );
    return {
      ...this.permissionSummary(permission, platform),
      rolesUsingCount: rolesUsing.length,
      rolesUsing,
    };
  }

  async permissionRoles(platform: AuthorizationPlatform, permissionId: string) {
    const permission = await this.getPermission(platform, permissionId);
    return { items: permission.rolesUsing };
  }

  async roleSubjects(
    platform: AuthorizationPlatform,
    roleId: string,
    query: AuthorizationSubjectListQueryDto,
  ) {
    const role = await this.getRole(platform, roleId);
    const subjects = await this.listSubjects(platform, query, roleId);
    return { role, ...subjects };
  }

  async matrix(platform: AuthorizationPlatform) {
    const config = this.config(platform);
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
    const permissionGroups = new Map<string, unknown[]>();
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

  async listSubjects(
    platform: AuthorizationPlatform,
    query: AuthorizationSubjectListQueryDto,
    roleId?: string,
  ) {
    const config = this.config(platform);
    const pagination = PaginationHelper.normalize(query);
    const parameters: unknown[] = [];
    const where: string[] = ['subject.deleted_at IS NULL'];
    const subjectStatus =
      platform === AuthorizationPlatform.MARKETPLACE
        ? "'ACTIVE'"
        : platform === AuthorizationPlatform.PROVIDER
          ? 'subject.status'
          : "CASE WHEN subject.is_active THEN 'ACTIVE' ELSE 'DISABLED' END";
    let displayName = 'subject.id::text';
    let secondaryText = 'NULL::text';
    if (platform === AuthorizationPlatform.MARKETPLACE) {
      displayName = 'subject.email';
      secondaryText = 'subject.email';
    } else if (platform === AuthorizationPlatform.PROVIDER) {
      displayName = 'provider.display_name';
      secondaryText = 'customer.email';
    } else {
      displayName = 'subject.email';
      secondaryText = 'subject.email';
    }
    if (query.q) {
      parameters.push(`%${query.q.trim()}%`);
      where.push(
        `(${displayName} ILIKE $${parameters.length} OR ${secondaryText} ILIKE $${parameters.length} OR subject.id::text ILIKE $${parameters.length})`,
      );
    }
    if (query.status) {
      parameters.push(query.status);
      where.push(`${subjectStatus} = $${parameters.length}`);
    }
    if (roleId) {
      parameters.push(roleId);
      where.push(
        `EXISTS (SELECT 1 FROM ${config.assignmentTable} role_filter WHERE role_filter.${config.assignmentSubjectColumn} = subject.id AND role_filter.role_id = $${parameters.length})`,
      );
    }
    const joinSql =
      platform === AuthorizationPlatform.PROVIDER
        ? `INNER JOIN tbl_provider_account provider ON provider.id = subject.provider_id
         INNER JOIN tbl_customer_account customer ON customer.id = subject.customer_id`
        : '';
    const whereSql = where.join(' AND ');
    const offset = (pagination.page - 1) * pagination.limit;
    const countRows = await this.dataSource.query<{ total: string }[]>(
      `SELECT COUNT(*)::text AS total FROM ${config.subjectTable} subject ${joinSql} WHERE ${whereSql}`,
      parameters,
    );
    const rows = await this.dataSource.query<SubjectRow[]>(
      `SELECT subject.id, ${displayName} AS display_name, ${secondaryText} AS secondary_text,
              ${subjectStatus} AS status, COUNT(assignment.role_id)::int AS role_count,
              COALESCE(array_agg(assignment.role_id) FILTER (WHERE assignment.role_id IS NOT NULL), ARRAY[]::uuid[]) AS role_ids
       FROM ${config.subjectTable} subject ${joinSql}
       LEFT JOIN ${config.assignmentTable} assignment ON assignment.${config.assignmentSubjectColumn} = subject.id
       WHERE ${whereSql}
       GROUP BY subject.id, ${displayName}, ${secondaryText}, ${subjectStatus}
       ORDER BY display_name, subject.id
       LIMIT ${pagination.limit} OFFSET ${offset}`,
      parameters,
    );
    return PaginationHelper.buildMeta(
      rows.map((row) => ({
        id: row.id,
        subjectType: config.subjectType,
        displayName: row.display_name,
        secondaryText: row.secondary_text,
        status: row.status,
        roleCount: row.role_count,
        roleIds: row.role_ids,
      })),
      Number(countRows[0]?.total ?? 0),
      pagination,
    );
  }

  async getSubject(platform: AuthorizationPlatform, subjectId: string) {
    const config = this.config(platform);
    const query: AuthorizationSubjectListQueryDto = {
      page: 1,
      limit: 1,
      q: subjectId,
    };
    const subjects = await this.listSubjects(platform, query);
    const subject = subjects.items.find((item) => item.id === subjectId);
    if (!subject) {
      throw new BusinessException(AuthorizationErrorCodes.SUBJECT_NOT_FOUND, {
        subjectId,
        platform,
      });
    }
    const roleIds = await this.roleIds(config, subjectId);
    const roles = roleIds.length
      ? await this.dataSource.query<
          { id: string; code: string; name: string; status: string }[]
        >(
          `SELECT id, code, name, status FROM ${config.roleTable} WHERE id = ANY($1::uuid[]) AND deleted_at IS NULL ORDER BY code`,
          [roleIds],
        )
      : [];
    const permissions = await this.dataSource.query<PermissionRow[]>(
      `SELECT DISTINCT permission.id, permission.code, permission.name, permission.description, permission.category,
              permission.resource, permission.action, permission.risk_level, permission.is_assignable,
              permission.deprecated_at, permission.created_at, permission.updated_at
       FROM ${config.permissionTable} permission
       INNER JOIN ${config.rolePermissionTable} mapping ON mapping.permission_id = permission.id
       WHERE mapping.role_id = ANY($1::uuid[]) AND permission.deleted_at IS NULL
         AND permission.deprecated_at IS NULL ORDER BY permission.code`,
      [roleIds.length ? roleIds : ['00000000-0000-0000-0000-000000000000']],
    );
    const detail: Record<string, unknown> = {
      ...subject,
      roles,
      permissions: permissions.map((p) => this.permissionSummary(p, platform)),
    };
    if (platform === AuthorizationPlatform.PROVIDER) {
      const rows = await this.dataSource.query<
        {
          provider_id: string;
          provider_display_name: string;
          customer_id: string;
          customer_email: string;
        }[]
      >(
        `SELECT membership.provider_id, provider.display_name AS provider_display_name, membership.customer_id, customer.email AS customer_email
         FROM tbl_provider_membership membership
         INNER JOIN tbl_provider_account provider ON provider.id = membership.provider_id
         INNER JOIN tbl_customer_account customer ON customer.id = membership.customer_id
         WHERE membership.id = $1`,
        [subjectId],
      );
      Object.assign(detail, rows[0] ?? {});
    }
    return detail;
  }

  async replaceSubjectRoles(
    platform: AuthorizationPlatform,
    subjectId: string,
    dto: ReplaceSubjectRolesDto,
    actorAdministratorId: string,
    requestId: string | null,
  ) {
    const config = this.config(platform);
    const roleIds = [...new Set(dto.roleIds)];
    await this.dataSource.transaction(async (manager) => {
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
        await manager.query(
          `SELECT pg_advisory_xact_lock(hashtext('authorization:last-admin-protection'))`,
        );
        const admins = await this.countAdminsWithPermission(
          manager,
          ADMINISTRATION_PERMISSIONS.AUTHORIZATION_ROLE_WRITE,
        );
        if (admins === 0) {
          throw new BusinessException(
            AuthorizationErrorCodes.LAST_ADMIN_PROTECTION,
          );
        }
      }
      if (platform === AuthorizationPlatform.PROVIDER) {
        const ownerRows = await manager.query<{ id: string }[]>(
          `SELECT id FROM tbl_provider_role WHERE code = 'OWNER' AND deleted_at IS NULL`,
        );
        const ownerRoleId = ownerRows[0]?.id;
        if (ownerRoleId && !roleIds.includes(ownerRoleId)) {
          const membershipRows = await manager.query<{ provider_id: string }[]>(
            `SELECT provider_id FROM tbl_provider_membership WHERE id = $1`,
            [subjectId],
          );
          const providerId = membershipRows[0]?.provider_id;
          if (providerId) {
            await manager.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [
              `provider:last-owner-protection:${providerId}`,
            ]);
          }
          const ownerCount = providerId
            ? await manager.query<{ count: string }[]>(
                `SELECT COUNT(*)::text AS count FROM tbl_provider_membership_role assignment
                 INNER JOIN tbl_provider_membership membership ON membership.id = assignment.membership_id
                 WHERE membership.provider_id = $1 AND membership.status = 'ACTIVE' AND assignment.role_id = $2`,
                [providerId, ownerRoleId],
              )
            : [{ count: '0' }];
          if (Number(ownerCount[0]?.count ?? 0) === 0) {
            throw new BusinessException(
              AuthorizationErrorCodes.PROVIDER_LAST_OWNER_PROTECTION,
              { providerId },
            );
          }
        }
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
    return this.getSubject(platform, subjectId);
  }

  async audit(query: AuthorizationAuditQueryDto) {
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
      rows,
      Number(countRows[0]?.total ?? 0),
      pagination,
    );
  }

  async providerMembers(
    providerId: string,
    query: AuthorizationSubjectListQueryDto,
  ) {
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

  private config(platform: AuthorizationPlatform): PlatformConfig {
    const config = CONFIGS[platform];
    if (!config) {
      throw new BusinessException(AuthorizationErrorCodes.PLATFORM_NOT_FOUND, {
        platform,
      });
    }
    return config;
  }

  private async findRole(
    config: PlatformConfig,
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
    config: PlatformConfig,
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
    config: PlatformConfig,
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
    config: PlatformConfig,
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
    config: PlatformConfig,
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
      const otherTables = Object.values(CONFIGS)
        .filter(
          (candidate) => candidate.permissionTable !== config.permissionTable,
        )
        .map((candidate) => candidate.permissionTable);
      const crossRows = await manager.query<{ id: string }[]>(
        `SELECT id FROM ${otherTables.map((table) => `SELECT id FROM ${table} WHERE id = ANY($1::uuid[])`).join(' UNION ALL ')}`,
        [ids],
      );
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
    config: PlatformConfig,
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
      const otherTables = Object.values(CONFIGS)
        .filter((candidate) => candidate.roleTable !== config.roleTable)
        .map((candidate) => candidate.roleTable);
      const crossRows = await manager.query<{ id: string }[]>(
        `SELECT id FROM ${otherTables
          .map((table) => `SELECT id FROM ${table} WHERE id = ANY($1::uuid[])`)
          .join(' UNION ALL ')}`,
        [ids],
      );
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

  private async countAdminsWithPermission(
    manager: EntityManager,
    code: string,
  ): Promise<number> {
    const rows = await manager.query<{ count: string }[]>(
      `SELECT COUNT(DISTINCT assignment.administrator_id)::text AS count
       FROM tbl_administrator_role_assignment assignment
       INNER JOIN tbl_administration_role role ON role.id = assignment.role_id
       INNER JOIN tbl_administration_role_permission mapping ON mapping.role_id = role.id
       INNER JOIN tbl_administration_permission permission ON permission.id = mapping.permission_id
       INNER JOIN tbl_administrator_account administrator ON administrator.id = assignment.administrator_id
       WHERE administrator.is_active = true AND administrator.deleted_at IS NULL
         AND role.status = 'ACTIVE' AND role.deleted_at IS NULL
         AND permission.code = $1 AND permission.deleted_at IS NULL`,
      [code],
    );
    return Number(rows[0]?.count ?? 0);
  }

  private async writeAudit(
    manager: EntityManager | DataSource,
    event: AuditEvent,
  ): Promise<void> {
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

  private roleSummary(row: RoleRow) {
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
      isEditable: true,
      isDeletable: !row.is_system,
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
  risk_level: string;
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

type SubjectRow = {
  id: string;
  display_name: string;
  secondary_text: string | null;
  status: string;
  role_count: number;
  role_ids: string[];
};

type AuditEvent = {
  actorAdministratorId: string;
  platform: AuthorizationPlatform;
  action: string;
  targetType: string;
  targetId: string | null;
  reason: string | null;
  beforeState: Record<string, unknown> | null;
  afterState: Record<string, unknown> | null;
  requestId: string | null;
};
