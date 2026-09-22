import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Preserves the read access that valid provider members had before supply
 * operations became permission-gated. Write capabilities remain OWNER-only.
 *
 * The bookkeeping table makes down() precise: only mappings inserted by this
 * migration are removed, while custom or pre-existing read mappings survive.
 */
export class BackfillProviderSupplyReadPermissions1790063077456 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS tbl_provider_supply_read_permission_backfill (
        role_id uuid NOT NULL,
        permission_id uuid NOT NULL,
        PRIMARY KEY (role_id, permission_id)
      )
    `);

    await queryRunner.query(`
      INSERT INTO tbl_provider_supply_read_permission_backfill
        (role_id, permission_id)
      SELECT DISTINCT assignment.role_id, permission.id
      FROM tbl_provider_membership_role assignment
      INNER JOIN tbl_provider_membership membership
        ON membership.id = assignment.membership_id
      INNER JOIN tbl_provider_account provider
        ON provider.id = membership.provider_id
      INNER JOIN tbl_provider_role role
        ON role.id = assignment.role_id
      CROSS JOIN tbl_provider_permission permission
      WHERE membership.status = 'ACTIVE'
        AND membership.deleted_at IS NULL
        AND provider.status = 'ACTIVE'
        AND provider.verification_status = 'VERIFIED'
        AND provider.deleted_at IS NULL
        AND role.status = 'ACTIVE'
        AND role.deleted_at IS NULL
        AND permission.code IN ('property:read', 'listing:read')
        AND permission.deleted_at IS NULL
        AND permission.deprecated_at IS NULL
        AND NOT EXISTS (
          SELECT 1
          FROM tbl_provider_role_permission existing_mapping
          WHERE existing_mapping.role_id = assignment.role_id
            AND existing_mapping.permission_id = permission.id
        )
      ON CONFLICT (role_id, permission_id) DO NOTHING
    `);

    await queryRunner.query(`
      INSERT INTO tbl_provider_role_permission (role_id, permission_id)
      SELECT role_id, permission_id
      FROM tbl_provider_supply_read_permission_backfill
      ON CONFLICT (role_id, permission_id) DO NOTHING
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DELETE FROM tbl_provider_role_permission mapping
      USING tbl_provider_supply_read_permission_backfill backfill
      WHERE mapping.role_id = backfill.role_id
        AND mapping.permission_id = backfill.permission_id
    `);
    await queryRunner.query(
      'DROP TABLE IF EXISTS tbl_provider_supply_read_permission_backfill',
    );
  }
}
