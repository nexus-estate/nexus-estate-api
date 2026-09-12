import { MigrationInterface, QueryRunner } from 'typeorm';

/** Adds the permission required to read the authenticated customer profile. */
export class AddCustomerProfilePermission1789301000000 implements MigrationInterface {
  /** Inserts the permission and assigns it to customer and administrator roles. */
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      INSERT INTO tbl_permission (name, description)
      VALUES ('customer:profile:read', 'Read the authenticated customer profile')
      ON CONFLICT (name) DO UPDATE
        SET description = EXCLUDED.description
    `);

    await queryRunner.query(`
      INSERT INTO tbl_role_permissions (role_id, permission_id)
      SELECT role.id, permission.id
      FROM tbl_role AS role
      CROSS JOIN tbl_permission AS permission
      WHERE role.name IN ('customer', 'administrator')
        AND permission.name = 'customer:profile:read'
      ON CONFLICT (role_id, permission_id) DO NOTHING
    `);
  }

  /** Removes only the permission and role mappings introduced by this migration. */
  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DELETE FROM tbl_role_permissions
      WHERE permission_id = (
        SELECT id
        FROM tbl_permission
        WHERE name = 'customer:profile:read'
      )
    `);
    await queryRunner.query(`
      DELETE FROM tbl_permission
      WHERE name = 'customer:profile:read'
    `);
  }
}
