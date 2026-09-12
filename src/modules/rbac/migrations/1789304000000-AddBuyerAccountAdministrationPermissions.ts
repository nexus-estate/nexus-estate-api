import { MigrationInterface, QueryRunner } from 'typeorm';

/** Adds administration permissions for the buyer-account bounded context. */
export class AddBuyerAccountAdministrationPermissions1789304000000 implements MigrationInterface {
  /** Creates buyer-account permissions and grants them to administrators. */
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      INSERT INTO tbl_permission (name, description)
      VALUES
        ('buyer-account:create', 'Create a buyer account'),
        ('buyer-account:read', 'View buyer account information'),
        ('buyer-account:update', 'Update buyer account information'),
        ('buyer-account:delete', 'Deactivate a buyer account'),
        ('buyer-account:assign-role', 'Assign a role to a buyer account')
      ON CONFLICT (name) DO UPDATE
        SET description = EXCLUDED.description
    `);

    await queryRunner.query(`
      INSERT INTO tbl_role_permissions (role_id, permission_id)
      SELECT role.id, permission.id
      FROM tbl_role AS role
      CROSS JOIN tbl_permission AS permission
      WHERE role.name = 'administrator'
        AND permission.name LIKE 'buyer-account:%'
      ON CONFLICT (role_id, permission_id) DO NOTHING
    `);
  }

  /** Removes only the permissions and administrator mappings introduced here. */
  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DELETE FROM tbl_role_permissions
      WHERE permission_id IN (
        SELECT id
        FROM tbl_permission
        WHERE name LIKE 'buyer-account:%'
      )
    `);
    await queryRunner.query(`
      DELETE FROM tbl_permission
      WHERE name LIKE 'buyer-account:%'
    `);
  }
}
