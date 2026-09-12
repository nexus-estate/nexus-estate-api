import { MigrationInterface, QueryRunner } from 'typeorm';

/** Idempotently grants existing administrator accounts scoped SUPER_ADMIN. */
export class BackfillAdministratorRoleAssignments1789400000001 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      INSERT INTO tbl_administrator_role_assignment (administrator_id, role_id)
      SELECT administrator.id, role.id
      FROM tbl_administrator_account administrator
      CROSS JOIN tbl_administration_role role
      WHERE role.code = 'SUPER_ADMIN'
        AND administrator.deleted_at IS NULL
        AND NOT EXISTS (
          SELECT 1
          FROM tbl_administrator_role_assignment existing_assignment
          WHERE existing_assignment.administrator_id = administrator.id
        )
      ON CONFLICT (administrator_id, role_id) DO NOTHING
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DELETE FROM tbl_administrator_role_assignment assignment
      USING tbl_administration_role role
      WHERE role.id = assignment.role_id
        AND role.code = 'SUPER_ADMIN'
    `);
  }
}
