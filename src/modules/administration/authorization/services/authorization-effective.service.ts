import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

/** Resolves current administration roles and permissions for /me/authorization. */
@Injectable()
export class AuthorizationEffectiveService {
  constructor(private readonly dataSource: DataSource) {}

  async effective(administratorId: string) {
    const state = await this.dataSource.query<{ is_active: boolean }[]>(
      `SELECT is_active FROM tbl_administrator_account WHERE id = $1 AND deleted_at IS NULL`,
      [administratorId],
    );
    const isActive = state[0]?.is_active === true;
    const roles = await this.dataSource.query<
      { id: string; code: string; name: string }[]
    >(
      `SELECT role.id, role.code, role.name
       FROM tbl_administrator_role_assignment assignment
       INNER JOIN tbl_administration_role role ON role.id = assignment.role_id
       WHERE assignment.administrator_id = $1 AND role.status = 'ACTIVE'
         AND role.deleted_at IS NULL ORDER BY role.code`,
      [administratorId],
    );
    const permissions = await this.dataSource.query<
      { id: string; code: string; name: string; category: string }[]
    >(
      `SELECT DISTINCT permission.id, permission.code, permission.name, permission.category
       FROM tbl_administrator_role_assignment assignment
       INNER JOIN tbl_administration_role role ON role.id = assignment.role_id
       INNER JOIN tbl_administration_role_permission mapping ON mapping.role_id = role.id
       INNER JOIN tbl_administration_permission permission ON permission.id = mapping.permission_id
       WHERE assignment.administrator_id = $1 AND role.status = 'ACTIVE'
         AND role.deleted_at IS NULL AND permission.deleted_at IS NULL
         AND permission.deprecated_at IS NULL ORDER BY permission.code`,
      [administratorId],
    );
    return {
      platform: 'ADMINISTRATION',
      isActive,
      roles: isActive ? roles : [],
      permissions: isActive ? permissions : [],
      authorizationVersion: await this.version(administratorId),
    };
  }

  private async version(administratorId: string): Promise<string> {
    const rows = await this.dataSource.query<{ version: string }[]>(
      `SELECT COALESCE(MAX(GREATEST(assignment.assigned_at, role.updated_at, COALESCE(permission.updated_at, TIMESTAMP 'epoch'))), TIMESTAMP 'epoch')::text AS version
       FROM tbl_administrator_role_assignment assignment
       INNER JOIN tbl_administration_role role ON role.id = assignment.role_id
       LEFT JOIN tbl_administration_role_permission mapping ON mapping.role_id = role.id
       LEFT JOIN tbl_administration_permission permission ON permission.id = mapping.permission_id
       WHERE assignment.administrator_id = $1`,
      [administratorId],
    );
    return rows[0]?.version ?? new Date(0).toISOString();
  }
}
