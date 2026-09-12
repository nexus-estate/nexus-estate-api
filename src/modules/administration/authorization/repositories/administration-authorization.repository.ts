import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import type { AdministrationPermissionCode } from '../constants/administration-permission.constant';

/** Reads current administration role assignments and permission mappings. */
@Injectable()
export class AdministrationAuthorizationRepository {
  constructor(private readonly dataSource: DataSource) {}

  /**
   * Resolves permission state from the database for every request. This keeps
   * revocations and assignment changes effective before access-token expiry.
   */
  async hasPermission(
    administratorId: string,
    permissionCode: AdministrationPermissionCode,
  ): Promise<boolean> {
    const rows = await this.dataSource.query<{ allowed: boolean }[]>(
      `
        SELECT EXISTS (
          SELECT 1
          FROM tbl_administrator_role_assignment assignment
          INNER JOIN tbl_administration_role_permission role_permission
            ON role_permission.role_id = assignment.role_id
          INNER JOIN tbl_administration_permission permission
            ON permission.id = role_permission.permission_id
          INNER JOIN tbl_administration_role role
            ON role.id = assignment.role_id
          INNER JOIN tbl_administrator_account administrator
            ON administrator.id = assignment.administrator_id
          WHERE assignment.administrator_id = $1
            AND administrator.is_active = true
            AND permission.code = $2
            AND permission.deleted_at IS NULL
            AND role.deleted_at IS NULL
            AND role.status = 'ACTIVE'
        ) AS allowed
      `,
      [administratorId, permissionCode],
    );

    return rows[0]?.allowed === true;
  }
}
