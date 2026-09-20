import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

import { BusinessException } from '../../../../../common/exceptions/business.exception';
import { PaginationHelper } from '../../../../../utils/helpers/pagination.helper';
import type {
  AuthorizationPermissionSummary,
  AuthorizationPermissionDetail,
  AuthorizationPermissionListResult,
  AuthorizationPermissionRoleReference,
  AuthorizationPermissionRolesResult,
} from '../../types/contracts/authorization-permission.contract';
import type { AuthorizationPermissionListQueryDto } from '../../dto/authorization-management.dto';
import { AuthorizationErrorCodes } from '../../errors/authorization-error-codes';
import {
  AuthorizationPlatform,
  AuthorizationRiskLevel,
} from '../../enums/authorization-platform.enum';
import { type AuthorizationContext } from '../../context/authorization-context';

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

const SORT_COLUMNS: Record<string, string> = {
  name: 'permission.name',
  code: 'permission.code',
  category: 'permission.category',
  resource: 'permission.resource',
  action: 'permission.action',
  createdAt: 'permission.created_at',
  updatedAt: 'permission.updated_at',
};

@Injectable()
/** SQL read repository for platform-scoped authorization permissions. */
export class AuthorizationPermissionRepository {
  constructor(private readonly dataSource: DataSource) {}

  /** Lists permission catalogue entries for a context. */
  async list(
    context: AuthorizationContext,
    query: AuthorizationPermissionListQueryDto,
  ): Promise<AuthorizationPermissionListResult> {
    const { platform, config } = context;
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

    const whereSql = where.join(' AND ');
    const orderBy =
      SORT_COLUMNS[query.sort ?? 'category'] ?? 'permission.category';
    const order = query.order === 'desc' ? 'DESC' : 'ASC';
    const offset = (pagination.page - 1) * pagination.limit;
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
      rows.map((row) => this.toSummary(row, platform)),
      Number(countRows[0]?.total ?? 0),
      pagination,
    );
  }

  /** Loads one permission and the roles that use it. */
  async findById(
    context: AuthorizationContext,
    permissionId: string,
  ): Promise<AuthorizationPermissionDetail> {
    const { platform, config } = context;
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
        {
          permissionId,
          platform,
        },
      );
    }
    const rolesUsing = await this.dataSource.query<
      AuthorizationPermissionRoleReference[]
    >(
      `SELECT role.id, role.code, role.name FROM ${config.roleTable} role
       INNER JOIN ${config.rolePermissionTable} mapping ON mapping.role_id = role.id
       WHERE mapping.permission_id = $1 AND role.deleted_at IS NULL ORDER BY role.code`,
      [permissionId],
    );
    return {
      ...this.toSummary(permission, platform),
      rolesUsingCount: rolesUsing.length,
      rolesUsing,
    };
  }

  /** Lists role references associated with a permission. */
  async roles(
    context: AuthorizationContext,
    permissionId: string,
  ): Promise<AuthorizationPermissionRolesResult> {
    const permission = await this.findById(context, permissionId);
    return { items: permission.rolesUsing };
  }

  private toSummary(
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
