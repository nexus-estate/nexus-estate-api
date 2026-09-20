import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

import { BusinessException } from '../../../../../common/exceptions/business.exception';
import { PaginationHelper } from '../../../../../utils';
import type {
  AuthorizationRoleDetail,
  AuthorizationRoleListResult,
  AuthorizationRoleSummary,
} from '../../types/contracts/authorization-role.contract';
import type { AuthorizationPermissionSummary } from '../../types/contracts/authorization-permission.contract';
import { AuthorizationErrorCodes } from '../../errors/authorization-error-codes';
import {
  AuthorizationPlatform,
  AuthorizationRoleStatus,
  AuthorizationRiskLevel,
} from '../../enums/authorization-platform.enum';
import type { AuthorizationRoleListQueryDto } from '../../dto/authorization-management.dto';
import {
  authorizationContext,
  type AuthorizationContextInput,
} from '../../context/authorization-context';

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

const ROLE_SORT_COLUMNS: Record<string, string> = {
  name: 'role.name',
  code: 'role.code',
  createdAt: 'role.created_at',
  updatedAt: 'role.updated_at',
  assignmentCount: 'assignment_count',
  permissionCount: 'permission_count',
};

@Injectable()
/** SQL read repository for platform-scoped authorization roles. */
export class AuthorizationRoleRepository {
  constructor(private readonly dataSource: DataSource) {}

  /** Lists role summaries and usage counts for a context. */
  async list(
    contextInput: AuthorizationContextInput,
    query: AuthorizationRoleListQueryDto,
  ): Promise<AuthorizationRoleListResult> {
    const context = authorizationContext(contextInput);
    const { platform, config } = context;
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
      `SELECT role.id, role.code, role.name, role.description,
              role.is_system, role.status, role.version,
              role.created_at, role.updated_at,
              (SELECT COUNT(*) FROM ${config.rolePermissionTable} mapping WHERE mapping.role_id = role.id) AS permission_count,
              (SELECT COUNT(*) FROM ${config.assignmentTable} assignment WHERE assignment.role_id = role.id) AS assignment_count
       FROM ${config.roleTable} role
       WHERE ${whereSql}
       ORDER BY ${orderBy} ${order}, role.id ASC
       LIMIT ${pagination.limit} OFFSET ${offset}`,
      parameters,
    );

    return PaginationHelper.buildMeta(
      rows.map((row) => this.toSummary(row, platform)),
      Number(countRows[0]?.total ?? 0),
      pagination,
    );
  }

  /** Loads one role, its usage counts, and its assigned permissions. */
  async findById(
    contextInput: AuthorizationContextInput,
    roleId: string,
  ): Promise<AuthorizationRoleDetail> {
    const context = authorizationContext(contextInput);
    const { platform, config } = context;
    const roleRows = await this.dataSource.query<RoleRow[]>(
      `SELECT role.id, role.code, role.name, role.description,
              role.is_system, role.status, role.version,
              role.created_at, role.updated_at,
              (SELECT COUNT(*) FROM ${config.rolePermissionTable} mapping WHERE mapping.role_id = role.id) AS permission_count,
              (SELECT COUNT(*) FROM ${config.assignmentTable} assignment WHERE assignment.role_id = role.id) AS assignment_count
       FROM ${config.roleTable} role
       WHERE role.id = $1 AND role.deleted_at IS NULL`,
      [roleId],
    );
    const role = roleRows[0];
    if (!role) {
      throw new BusinessException(AuthorizationErrorCodes.ROLE_NOT_FOUND, {
        roleId,
        platform,
      });
    }

    const permissions = await this.dataSource.query<PermissionRow[]>(
      `SELECT permission.id, permission.code, permission.name,
              permission.description, permission.category,
              permission.resource, permission.action, permission.risk_level,
              permission.is_assignable, permission.deprecated_at,
              permission.created_at, permission.updated_at
       FROM ${config.permissionTable} permission
       INNER JOIN ${config.rolePermissionTable} mapping
         ON mapping.permission_id = permission.id
       WHERE mapping.role_id = $1 AND permission.deleted_at IS NULL
       ORDER BY permission.category ASC, permission.code ASC`,
      [roleId],
    );

    return {
      ...this.toSummary(role, platform),
      permissions: permissions.map((permission) =>
        this.toPermissionSummary(permission, platform),
      ),
    };
  }

  private toSummary(
    row: RoleRow,
    platform: AuthorizationPlatform,
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

  private toPermissionSummary(
    row: PermissionRow,
    platform: AuthorizationPlatform,
  ): AuthorizationPermissionSummary {
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
}
