import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

import { BusinessException } from '../../../../../common/exceptions/business.exception';
import { PaginationHelper } from '../../../../../utils/helpers/pagination.helper';
import type { AuthorizationPermissionSummary } from '../../types/contracts/authorization-role.contract';
import type { AuthorizationSubjectListResult } from '../../types/contracts/authorization-role.contract';
import type {
  AuthorizationSubjectDetail,
  AuthorizationSubjectRoleReference,
} from '../../types/contracts/authorization-subject.contract';
import type { AuthorizationSubjectListQueryDto } from '../../dto/authorization-management.dto';
import { AuthorizationErrorCodes } from '../../errors/authorization-error-codes';
import { AuthorizationPlatform } from '../../enums/authorization-platform.enum';
import {
  platformAuthorizationSqlConfig,
  type PlatformAuthorizationSqlConfig,
} from '../../management/platform-authorization-config';

type SubjectRow = {
  id: string;
  display_name: string;
  secondary_text: string | null;
  status: string;
  role_count: number;
  role_ids: string[];
};

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

@Injectable()
export class AuthorizationSubjectRepository {
  constructor(private readonly dataSource: DataSource) {}

  async list(
    platform: AuthorizationPlatform,
    query: AuthorizationSubjectListQueryDto,
    roleId?: string,
  ): Promise<AuthorizationSubjectListResult> {
    const config = this.config(platform);
    const pagination = PaginationHelper.normalize(query);
    const parameters: unknown[] = [];
    const where: string[] = ['subject.deleted_at IS NULL'];
    const { statusExpression, displayName, secondaryText } =
      this.subjectExpressions(platform);

    if (query.q) {
      parameters.push(`%${query.q.trim()}%`);
      where.push(
        `(${displayName} ILIKE $${parameters.length} OR ${secondaryText} ILIKE $${parameters.length} OR subject.id::text ILIKE $${parameters.length})`,
      );
    }
    if (query.status) {
      parameters.push(query.status);
      where.push(`${statusExpression} = $${parameters.length}`);
    }
    if (roleId) {
      parameters.push(roleId);
      where.push(
        `EXISTS (SELECT 1 FROM ${config.assignmentTable} role_filter WHERE role_filter.${config.assignmentSubjectColumn} = subject.id AND role_filter.role_id = $${parameters.length})`,
      );
    }

    const joinSql = this.providerJoin(platform);
    const whereSql = where.join(' AND ');
    const offset = (pagination.page - 1) * pagination.limit;
    const countRows = await this.dataSource.query<{ total: string }[]>(
      `SELECT COUNT(*)::text AS total FROM ${config.subjectTable} subject ${joinSql} WHERE ${whereSql}`,
      parameters,
    );
    const rows = await this.dataSource.query<SubjectRow[]>(
      `SELECT subject.id, ${displayName} AS display_name, ${secondaryText} AS secondary_text,
              ${statusExpression} AS status, COUNT(assignment.role_id)::int AS role_count,
              COALESCE(array_agg(assignment.role_id) FILTER (WHERE assignment.role_id IS NOT NULL), ARRAY[]::uuid[]) AS role_ids
       FROM ${config.subjectTable} subject ${joinSql}
       LEFT JOIN ${config.assignmentTable} assignment ON assignment.${config.assignmentSubjectColumn} = subject.id
       WHERE ${whereSql}
       GROUP BY subject.id, ${displayName}, ${secondaryText}, ${statusExpression}
       ORDER BY display_name, subject.id
       LIMIT ${pagination.limit} OFFSET ${offset}`,
      parameters,
    );

    return PaginationHelper.buildMeta(
      rows.map((row) => this.toSummary(row, config)),
      Number(countRows[0]?.total ?? 0),
      pagination,
    );
  }

  async findById(
    platform: AuthorizationPlatform,
    subjectId: string,
  ): Promise<AuthorizationSubjectDetail> {
    const config = this.config(platform);
    const { statusExpression, displayName, secondaryText } =
      this.subjectExpressions(platform);
    const joinSql = this.providerJoin(platform);
    const rows = await this.dataSource.query<SubjectRow[]>(
      `SELECT subject.id, ${displayName} AS display_name, ${secondaryText} AS secondary_text,
              ${statusExpression} AS status, COUNT(assignment.role_id)::int AS role_count,
              COALESCE(array_agg(assignment.role_id) FILTER (WHERE assignment.role_id IS NOT NULL), ARRAY[]::uuid[]) AS role_ids
       FROM ${config.subjectTable} subject ${joinSql}
       LEFT JOIN ${config.assignmentTable} assignment ON assignment.${config.assignmentSubjectColumn} = subject.id
       WHERE subject.id = $1 AND subject.deleted_at IS NULL
       GROUP BY subject.id, ${displayName}, ${secondaryText}, ${statusExpression}`,
      [subjectId],
    );
    const row = rows[0];
    if (!row) {
      throw new BusinessException(AuthorizationErrorCodes.SUBJECT_NOT_FOUND, {
        subjectId,
        platform,
      });
    }

    const roles = row.role_ids.length
      ? await this.dataSource.query<AuthorizationSubjectRoleReference[]>(
          `SELECT id, code, name, status FROM ${config.roleTable} WHERE id = ANY($1::uuid[]) AND deleted_at IS NULL ORDER BY code`,
          [row.role_ids],
        )
      : [];
    const permissions = await this.dataSource.query<PermissionRow[]>(
      `SELECT DISTINCT permission.id, permission.code, permission.name, permission.description,
              permission.category, permission.resource, permission.action,
              permission.risk_level, permission.is_assignable, permission.deprecated_at,
              permission.created_at, permission.updated_at
       FROM ${config.permissionTable} permission
       INNER JOIN ${config.rolePermissionTable} mapping ON mapping.permission_id = permission.id
       WHERE mapping.role_id = ANY($1::uuid[]) AND permission.deleted_at IS NULL
         AND permission.deprecated_at IS NULL ORDER BY permission.code`,
      [
        row.role_ids.length
          ? row.role_ids
          : ['00000000-0000-0000-0000-000000000000'],
      ],
    );

    const subject = this.toSummary(row, config);
    const detail: AuthorizationSubjectDetail = {
      ...subject,
      roles,
      permissions: permissions.map((permission) =>
        this.toPermissionSummary(permission, platform),
      ),
    };
    if (platform === AuthorizationPlatform.PROVIDER) {
      const membership = await this.dataSource.query<
        {
          provider_id: string;
          provider_display_name: string;
          customer_id: string;
          customer_email: string;
        }[]
      >(
        `SELECT membership.provider_id, provider.display_name AS provider_display_name,
                membership.customer_id, customer.email AS customer_email
         FROM tbl_provider_membership membership
         INNER JOIN tbl_provider_account provider ON provider.id = membership.provider_id
         INNER JOIN tbl_customer_account customer ON customer.id = membership.customer_id
         WHERE membership.id = $1`,
        [subjectId],
      );
      Object.assign(detail, membership[0] ?? {});
    }
    return detail;
  }

  private config(
    platform: AuthorizationPlatform,
  ): PlatformAuthorizationSqlConfig {
    const config = platformAuthorizationSqlConfig(platform);
    if (!config) {
      throw new BusinessException(AuthorizationErrorCodes.PLATFORM_NOT_FOUND, {
        platform,
      });
    }
    return config;
  }

  private subjectExpressions(platform: AuthorizationPlatform): {
    statusExpression: string;
    displayName: string;
    secondaryText: string;
  } {
    if (platform === AuthorizationPlatform.MARKETPLACE) {
      return {
        statusExpression: "'ACTIVE'",
        displayName: 'subject.email',
        secondaryText: 'subject.email',
      };
    }
    if (platform === AuthorizationPlatform.PROVIDER) {
      return {
        statusExpression: 'subject.status',
        displayName: 'provider.display_name',
        secondaryText: 'customer.email',
      };
    }
    return {
      statusExpression:
        "CASE WHEN subject.is_active THEN 'ACTIVE' ELSE 'DISABLED' END",
      displayName: 'subject.email',
      secondaryText: 'subject.email',
    };
  }

  private providerJoin(platform: AuthorizationPlatform): string {
    return platform === AuthorizationPlatform.PROVIDER
      ? `INNER JOIN tbl_provider_account provider ON provider.id = subject.provider_id
         INNER JOIN tbl_customer_account customer ON customer.id = subject.customer_id`
      : '';
  }

  private toSummary(row: SubjectRow, config: PlatformAuthorizationSqlConfig) {
    return {
      id: row.id,
      subjectType: config.subjectType,
      displayName: row.display_name,
      secondaryText: row.secondary_text,
      status: row.status,
      roleCount: row.role_count,
      roleIds: row.role_ids,
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
