import { MigrationInterface, QueryRunner } from 'typeorm';

export class ResetAndSeedRbacPermissions1787881549422 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        IF (
          SELECT COUNT(DISTINCT name)
          FROM tbl_role
          WHERE name IN ('administrator', 'provider', 'customer')
        ) <> 3 THEN
          RAISE EXCEPTION
            'Cannot seed RBAC permissions: administrator, provider, and customer roles must all exist';
        END IF;
      END
      $$;
    `);

    await queryRunner.query(`DELETE FROM tbl_role_permissions`);
    await queryRunner.query(`DELETE FROM tbl_permission`);

    await queryRunner.query(`
      INSERT INTO tbl_permission (name)
      VALUES
        ('user:create'),
        ('user:read'),
        ('user:update'),
        ('user:delete'),
        ('user:assign-role'),
        ('estate:create'),
        ('estate:read'),
        ('estate:update'),
        ('estate:delete'),
        ('estate:approve'),
        ('estate:reject'),
        ('estate:feature'),
        ('media:upload'),
        ('media:read'),
        ('media:update'),
        ('media:delete'),
        ('lead:create'),
        ('lead:read'),
        ('lead:update'),
        ('lead:delete'),
        ('role:create'),
        ('role:read'),
        ('role:update'),
        ('role:delete'),
        ('role:assign-permission'),
        ('permission:create'),
        ('permission:read'),
        ('permission:update'),
        ('permission:delete'),
        ('location:manage'),
        ('system:config'),
        ('system:audit')
    `);

    await queryRunner.query(`
      INSERT INTO tbl_role_permissions (role_id, permission_id)
      SELECT role.id, permission.id
      FROM tbl_role AS role
      CROSS JOIN tbl_permission AS permission
      WHERE role.name = 'admin'
      ON CONFLICT (role_id, permission_id) DO NOTHING
    `);

    await queryRunner.query(`
      INSERT INTO tbl_role_permissions (role_id, permission_id)
      SELECT role.id, permission.id
      FROM (
        VALUES
          ('broker', 'estate:create'),
          ('broker', 'estate:read'),
          ('broker', 'estate:update'),
          ('broker', 'estate:delete'),
          ('broker', 'media:upload'),
          ('broker', 'media:read'),
          ('broker', 'media:update'),
          ('broker', 'media:delete'),
          ('broker', 'lead:read'),
          ('broker', 'lead:update'),
          ('broker', 'lead:delete'),
          ('customer', 'estate:read'),
          ('customer', 'lead:create')
      ) AS mapping(role_name, permission_name)
      INNER JOIN tbl_role AS role ON role.name = mapping.role_name
      INNER JOIN tbl_permission AS permission
        ON permission.name = mapping.permission_name
      ON CONFLICT (role_id, permission_id) DO NOTHING
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const permissionNames = `
      'user:create',
      'user:read',
      'user:update',
      'user:delete',
      'user:assign-role',
      'estate:create',
      'estate:read',
      'estate:update',
      'estate:delete',
      'estate:approve',
      'estate:reject',
      'estate:feature',
      'media:upload',
      'media:read',
      'media:update',
      'media:delete',
      'lead:create',
      'lead:read',
      'lead:update',
      'lead:delete',
      'role:create',
      'role:read',
      'role:update',
      'role:delete',
      'role:assign-permission',
      'permission:create',
      'permission:read',
      'permission:update',
      'permission:delete',
      'location:manage',
      'system:config',
      'system:audit'
    `;

    await queryRunner.query(`
      DELETE FROM tbl_role_permissions
      WHERE permission_id IN (
        SELECT id
        FROM tbl_permission
        WHERE name IN (${permissionNames})
      )
    `);

    await queryRunner.query(`
      DELETE FROM tbl_permission
      WHERE name IN (${permissionNames})
    `);
  }
}
