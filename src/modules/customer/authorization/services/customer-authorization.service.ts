import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

/** Resolves current Marketplace authorization for a customer. */
@Injectable()
export class CustomerAuthorizationService {
  constructor(private readonly dataSource: DataSource) {}

  async effective(customerId: string) {
    const roles = await this.dataSource.query<
      { id: string; code: string; name: string }[]
    >(
      `SELECT role.id, role.code, role.name
       FROM tbl_customer_role_assignment assignment
       INNER JOIN tbl_marketplace_role role ON role.id = assignment.role_id
       WHERE assignment.customer_id = $1 AND role.status = 'ACTIVE'
         AND role.deleted_at IS NULL ORDER BY role.code`,
      [customerId],
    );
    const permissions = await this.dataSource.query<
      { id: string; code: string; name: string; category: string }[]
    >(
      `SELECT DISTINCT permission.id, permission.code, permission.name, permission.category
       FROM tbl_customer_role_assignment assignment
       INNER JOIN tbl_marketplace_role role ON role.id = assignment.role_id
       INNER JOIN tbl_marketplace_role_permission mapping ON mapping.role_id = role.id
       INNER JOIN tbl_marketplace_permission permission ON permission.id = mapping.permission_id
       WHERE assignment.customer_id = $1 AND role.status = 'ACTIVE'
         AND role.deleted_at IS NULL AND permission.deleted_at IS NULL
         AND permission.deprecated_at IS NULL ORDER BY permission.code`,
      [customerId],
    );
    return {
      platform: 'MARKETPLACE',
      roles,
      permissions,
      authorizationVersion: await this.version(customerId),
    };
  }

  private async version(customerId: string): Promise<string> {
    const rows = await this.dataSource.query<{ version: string }[]>(
      `SELECT COALESCE(MAX(GREATEST(assignment.assigned_at, role.updated_at, COALESCE(permission.updated_at, TIMESTAMP 'epoch'))), TIMESTAMP 'epoch')::text AS version
       FROM tbl_customer_role_assignment assignment
       INNER JOIN tbl_marketplace_role role ON role.id = assignment.role_id
       LEFT JOIN tbl_marketplace_role_permission mapping ON mapping.role_id = role.id
       LEFT JOIN tbl_marketplace_permission permission ON permission.id = mapping.permission_id
       WHERE assignment.customer_id = $1`,
      [customerId],
    );
    return rows[0]?.version ?? new Date(0).toISOString();
  }
}
