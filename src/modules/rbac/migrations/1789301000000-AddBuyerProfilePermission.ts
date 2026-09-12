import { MigrationInterface, QueryRunner } from 'typeorm';

/** Adds the permission required to read the authenticated buyer profile. */
export class AddBuyerProfilePermission1789301000000 implements MigrationInterface {
  /** Inserts the permission and assigns it to buyer and administrator roles. */
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      INSERT INTO tbl_permission (name, description)
      VALUES ('buyer:profile:read', 'Read the authenticated buyer profile')
      ON CONFLICT (name) DO UPDATE
        SET description = EXCLUDED.description
    `);

    await queryRunner.query(`
      INSERT INTO tbl_role_permissions (role_id, permission_id)
      SELECT role.id, permission.id
      FROM tbl_role AS role
      CROSS JOIN tbl_permission AS permission
      WHERE role.name IN ('buyer', 'administrator')
        AND permission.name = 'buyer:profile:read'
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
        WHERE name = 'buyer:profile:read'
      )
    `);
    await queryRunner.query(`
      DELETE FROM tbl_permission
      WHERE name = 'buyer:profile:read'
    `);
  }
}
