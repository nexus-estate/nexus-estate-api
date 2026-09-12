import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Aligns the initial RBAC seed with the platform access model.
 *
 * The anonymous actor is not stored in tbl_role. It is represented by
 * @Public() on endpoints that may be called without a JWT. Persisted roles
 * remain limited to administrator, provider, and customer.
 */
export class AlignBaseRolesAndPermissions1789300000000 implements MigrationInterface {
  /** Renames legacy roles and adds the permission catalogue for current APIs. */
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE tbl_role
      SET name = 'administrator',
          description = 'System administrator with full internal access'
      WHERE name = 'admin'
    `);
    await queryRunner.query(`
      UPDATE tbl_role
      SET name = 'provider',
          description = 'Provider operating on the marketplace platform'
      WHERE name = 'broker'
    `);
    await queryRunner.query(`
      UPDATE tbl_role
      SET description = 'Customer using the marketplace'
      WHERE name = 'customer'
    `);

    await queryRunner.query(`
      INSERT INTO tbl_permission (name, description)
      VALUES
        ('provider-account:register', 'Register a provider account'),
        ('provider-account:read', 'Read the current provider account'),
        ('provider-account:update', 'Update the current provider account profile'),
        ('provider-account:approve', 'Approve provider onboarding'),
        ('provider-account:suspend', 'Suspend or reinstate a provider account'),
        ('metrics:read', 'Read operational and business metrics'),
        ('admin-portal:access', 'Access internal administrator portal APIs')
      ON CONFLICT (name) DO UPDATE
        SET description = EXCLUDED.description
    `);

    // Administrators receive the complete catalogue, including permissions
    // added by future module migrations through an explicit role assignment.
    await queryRunner.query(`
      INSERT INTO tbl_role_permissions (role_id, permission_id)
      SELECT role.id, permission.id
      FROM tbl_role AS role
      CROSS JOIN tbl_permission AS permission
      WHERE role.name = 'administrator'
      ON CONFLICT (role_id, permission_id) DO NOTHING
    `);

    // Customers may browse public marketplace data and start provider onboarding,
    // but they do not receive provider supply or administrator permissions.
    await queryRunner.query(`
      INSERT INTO tbl_role_permissions (role_id, permission_id)
      SELECT role.id, permission.id
      FROM (
        VALUES
          ('customer', 'estate:read'),
          ('customer', 'lead:create'),
          ('customer', 'provider-account:register'),
          ('customer', 'provider-account:read'),
          ('customer', 'provider-account:update')
      ) AS mapping(role_name, permission_name)
      INNER JOIN tbl_role AS role ON role.name = mapping.role_name
      INNER JOIN tbl_permission AS permission
        ON permission.name = mapping.permission_name
      ON CONFLICT (role_id, permission_id) DO NOTHING
    `);

    // Provider permissions cover provider account and supply actions;
    // approval and system administration remain administrator-only.
    await queryRunner.query(`
      INSERT INTO tbl_role_permissions (role_id, permission_id)
      SELECT role.id, permission.id
      FROM (
        VALUES
          ('provider', 'provider-account:read'),
          ('provider', 'provider-account:update'),
          ('provider', 'estate:create'),
          ('provider', 'estate:read'),
          ('provider', 'estate:update'),
          ('provider', 'estate:delete'),
          ('provider', 'media:upload'),
          ('provider', 'media:read'),
          ('provider', 'media:update'),
          ('provider', 'media:delete'),
          ('provider', 'lead:read'),
          ('provider', 'lead:update'),
          ('provider', 'lead:delete')
      ) AS mapping(role_name, permission_name)
      INNER JOIN tbl_role AS role ON role.name = mapping.role_name
      INNER JOIN tbl_permission AS permission
        ON permission.name = mapping.permission_name
      ON CONFLICT (role_id, permission_id) DO NOTHING
    `);
  }

  /** Reverts the role names and removes only permissions introduced here. */
  public async down(queryRunner: QueryRunner): Promise<void> {
    const permissionNames = [
      'provider-account:register',
      'provider-account:read',
      'provider-account:update',
      'provider-account:approve',
      'provider-account:suspend',
      'metrics:read',
      'admin-portal:access',
    ];
    const quotedPermissionNames = permissionNames
      .map((name) => `'${name}'`)
      .join(', ');

    await queryRunner.query(`
      DELETE FROM tbl_role_permissions
      WHERE permission_id IN (
        SELECT id
        FROM tbl_permission
        WHERE name IN (${quotedPermissionNames})
      )
    `);
    await queryRunner.query(`
      DELETE FROM tbl_permission
      WHERE name IN (${quotedPermissionNames})
    `);
    await queryRunner.query(`
      UPDATE tbl_role
      SET name = 'broker',
          description = 'Real estate broker'
      WHERE name = 'provider'
    `);
    await queryRunner.query(`
      UPDATE tbl_role
      SET name = 'admin',
          description = 'System administrator with full access'
      WHERE name = 'administrator'
    `);
  }
}
