import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Converts legacy roleless provider readers to explicit, read-only MEMBER
 * access. This preserves the pre-permission-gate read contract without
 * retaining an implicit runtime fallback for zero-role memberships.
 */
export class BackfillRolelessProviderSupplyReaders1790065589751 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS tbl_provider_supply_member_role_backfill (
        role_id uuid PRIMARY KEY
      )
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS tbl_provider_supply_member_permission_backfill (
        role_id uuid NOT NULL,
        permission_id uuid NOT NULL,
        PRIMARY KEY (role_id, permission_id)
      )
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS tbl_provider_supply_member_assignment_backfill (
        membership_id uuid NOT NULL,
        role_id uuid NOT NULL,
        PRIMARY KEY (membership_id, role_id)
      )
    `);

    await queryRunner.query(`
      WITH inserted AS (
        INSERT INTO tbl_provider_role
          (code, name, description, is_system, status, version)
        VALUES (
          'MEMBER',
          'Member',
          'Baseline provider membership read access.',
          true,
          'ACTIVE',
          1
        )
        ON CONFLICT (code) DO NOTHING
        RETURNING id
      )
      INSERT INTO tbl_provider_supply_member_role_backfill (role_id)
      SELECT id FROM inserted
      ON CONFLICT (role_id) DO NOTHING
    `);

    await queryRunner.query(`
      UPDATE tbl_provider_role
      SET name = 'Member',
          description = 'Baseline provider membership read access.',
          is_system = true,
          status = 'ACTIVE',
          deleted_at = NULL,
          updated_at = CURRENT_TIMESTAMP
      WHERE code = 'MEMBER'
    `);

    await queryRunner.query(`
      INSERT INTO tbl_provider_supply_member_permission_backfill
        (role_id, permission_id)
      SELECT role.id, permission.id
      FROM tbl_provider_role role
      CROSS JOIN tbl_provider_permission permission
      WHERE role.code = 'MEMBER'
        AND permission.code IN ('property:read', 'listing:read')
        AND permission.deleted_at IS NULL
        AND permission.deprecated_at IS NULL
        AND NOT EXISTS (
          SELECT 1
          FROM tbl_provider_role_permission existing_mapping
          WHERE existing_mapping.role_id = role.id
            AND existing_mapping.permission_id = permission.id
        )
      ON CONFLICT (role_id, permission_id) DO NOTHING
    `);

    await queryRunner.query(`
      INSERT INTO tbl_provider_role_permission (role_id, permission_id)
      SELECT role_id, permission_id
      FROM tbl_provider_supply_member_permission_backfill
      ON CONFLICT (role_id, permission_id) DO NOTHING
    `);

    await queryRunner.query(`
      INSERT INTO tbl_provider_supply_member_assignment_backfill
        (membership_id, role_id)
      SELECT membership.id, role.id
      FROM tbl_provider_membership membership
      INNER JOIN tbl_provider_account provider
        ON provider.id = membership.provider_id
      INNER JOIN tbl_provider_role role
        ON role.code = 'MEMBER'
      WHERE membership.status = 'ACTIVE'
        AND membership.deleted_at IS NULL
        AND provider.status = 'ACTIVE'
        AND provider.verification_status = 'VERIFIED'
        AND provider.deleted_at IS NULL
        AND NOT EXISTS (
          SELECT 1
          FROM tbl_provider_membership_role existing_assignment
          INNER JOIN tbl_provider_role existing_role
            ON existing_role.id = existing_assignment.role_id
          WHERE existing_assignment.membership_id = membership.id
            AND existing_role.status = 'ACTIVE'
            AND existing_role.deleted_at IS NULL
        )
        AND NOT EXISTS (
          SELECT 1
          FROM tbl_provider_membership_role existing_member_assignment
          WHERE existing_member_assignment.membership_id = membership.id
            AND existing_member_assignment.role_id = role.id
        )
      ON CONFLICT (membership_id, role_id) DO NOTHING
    `);

    await queryRunner.query(`
      INSERT INTO tbl_provider_membership_role (membership_id, role_id)
      SELECT membership_id, role_id
      FROM tbl_provider_supply_member_assignment_backfill
      ON CONFLICT (membership_id, role_id) DO NOTHING
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DELETE FROM tbl_provider_membership_role assignment
      USING tbl_provider_supply_member_assignment_backfill backfill
      WHERE assignment.membership_id = backfill.membership_id
        AND assignment.role_id = backfill.role_id
    `);

    await queryRunner.query(`
      DELETE FROM tbl_provider_role_permission mapping
      USING tbl_provider_supply_member_permission_backfill backfill
      WHERE mapping.role_id = backfill.role_id
        AND mapping.permission_id = backfill.permission_id
        AND NOT EXISTS (
          SELECT 1
          FROM tbl_provider_membership_role assignment
          WHERE assignment.role_id = backfill.role_id
        )
    `);

    await queryRunner.query(`
      DELETE FROM tbl_provider_role role
      USING tbl_provider_supply_member_role_backfill backfill
      WHERE role.id = backfill.role_id
        AND NOT EXISTS (
          SELECT 1
          FROM tbl_provider_membership_role assignment
          WHERE assignment.role_id = role.id
        )
        AND NOT EXISTS (
          SELECT 1
          FROM tbl_provider_role_permission mapping
          WHERE mapping.role_id = role.id
        )
    `);

    await queryRunner.query(
      'DROP TABLE IF EXISTS tbl_provider_supply_member_assignment_backfill',
    );
    await queryRunner.query(
      'DROP TABLE IF EXISTS tbl_provider_supply_member_permission_backfill',
    );
    await queryRunner.query(
      'DROP TABLE IF EXISTS tbl_provider_supply_member_role_backfill',
    );
  }
}
