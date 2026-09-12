import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Aligns the initial RBAC seed with the platform access model.
 *
 * The anonymous actor is not stored in tbl_role. It is represented by
 * @Public() on endpoints that may be called without a JWT. Persisted roles
 * remain limited to administrator, seller, and buyer.
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
      SET name = 'seller',
          description = 'Seller operating on the Seller Platform'
      WHERE name = 'broker'
    `);
    await queryRunner.query(`
      UPDATE tbl_role
      SET description = 'Property buyer or renter'
      WHERE name = 'buyer'
    `);

    await queryRunner.query(`
      INSERT INTO tbl_permission (name, description)
      VALUES
        ('seller-account:register', 'Register a seller account'),
        ('seller-account:read', 'Read the current seller account'),
        ('seller-account:update', 'Update the current seller account profile'),
        ('seller-account:approve', 'Approve seller onboarding'),
        ('seller-account:suspend', 'Suspend or reinstate a seller account'),
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

    // Buyers may browse public marketplace data and start seller onboarding,
    // but they do not receive seller supply or administrator permissions.
    await queryRunner.query(`
      INSERT INTO tbl_role_permissions (role_id, permission_id)
      SELECT role.id, permission.id
      FROM (
        VALUES
          ('buyer', 'estate:read'),
          ('buyer', 'lead:create'),
          ('buyer', 'seller-account:register'),
          ('buyer', 'seller-account:read'),
          ('buyer', 'seller-account:update')
      ) AS mapping(role_name, permission_name)
      INNER JOIN tbl_role AS role ON role.name = mapping.role_name
      INNER JOIN tbl_permission AS permission
        ON permission.name = mapping.permission_name
      ON CONFLICT (role_id, permission_id) DO NOTHING
    `);

    // Seller permissions cover Seller Platform account and supply actions;
    // approval and system administration remain administrator-only.
    await queryRunner.query(`
      INSERT INTO tbl_role_permissions (role_id, permission_id)
      SELECT role.id, permission.id
      FROM (
        VALUES
          ('seller', 'seller-account:read'),
          ('seller', 'seller-account:update'),
          ('seller', 'estate:create'),
          ('seller', 'estate:read'),
          ('seller', 'estate:update'),
          ('seller', 'estate:delete'),
          ('seller', 'media:upload'),
          ('seller', 'media:read'),
          ('seller', 'media:update'),
          ('seller', 'media:delete'),
          ('seller', 'lead:read'),
          ('seller', 'lead:update'),
          ('seller', 'lead:delete')
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
      'seller-account:register',
      'seller-account:read',
      'seller-account:update',
      'seller-account:approve',
      'seller-account:suspend',
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
      WHERE name = 'seller'
    `);
    await queryRunner.query(`
      UPDATE tbl_role
      SET name = 'admin',
          description = 'System administrator with full access'
      WHERE name = 'administrator'
    `);
  }
}
