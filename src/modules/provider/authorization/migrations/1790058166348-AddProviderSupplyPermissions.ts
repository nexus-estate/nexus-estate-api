import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds provider supply permissions and preserves legacy provider read access.
 *
 * This migration intentionally owns the complete rollout as one atomic schema/data
 * change:
 * 1. create/update the supply permission catalogue and OWNER mappings;
 * 2. backfill read permissions for valid memberships that already have roles;
 * 3. convert valid legacy roleless memberships to an explicit read-only MEMBER role.
 *
 * Bookkeeping tables keep rollback precise and protect runtime-owned assignments
 * and mappings.
 */
export class AddProviderSupplyPermissions1790058166348 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Refuse custom MEMBER collisions before mutating permissions or mappings.
    const existingMemberRoles = (await queryRunner.query(`
      SELECT id::text AS id
      FROM tbl_provider_role
      WHERE code = 'MEMBER'
      LIMIT 1
    `)) as { id: string }[];

    let memberRoleId: string | undefined;

    if (existingMemberRoles.length > 0) {
      const bookkeepingTable = (await queryRunner.query(`
        SELECT to_regclass('public.tbl_provider_supply_member_role_backfill') IS NOT NULL AS exists
      `)) as { exists: boolean }[];
      const roleBackfill = bookkeepingTable[0]?.exists
        ? ((await queryRunner.query(
            `
              SELECT role_id::text AS role_id
              FROM tbl_provider_supply_member_role_backfill
              WHERE role_id = $1
            `,
            [existingMemberRoles[0].id],
          )) as { role_id: string }[])
        : [];

      if (roleBackfill.length === 0) {
        throw new Error(
          `Provider supply permission migration refused to reuse existing MEMBER role ${existingMemberRoles[0].id}: the role is not owned by this migration. Rename the custom role before rerunning the migration.`,
        );
      }

      memberRoleId = existingMemberRoles[0].id;
    }

    await queryRunner.query(`
      INSERT INTO tbl_provider_permission
        (code, name, description, category, resource, action, risk_level, is_assignable)
      VALUES
        ('property:read', 'Read provider properties', 'Read and list properties owned by the current provider.', 'Property', 'property', 'read', 'LOW', true),
        ('property:create', 'Create property', 'Create a new property for the current provider.', 'Property', 'property', 'create', 'MEDIUM', true),
        ('property:update', 'Update property', 'Update an existing property owned by the current provider.', 'Property', 'property', 'update', 'MEDIUM', true),
        ('property:archive', 'Archive property', 'Archive a property owned by the current provider.', 'Property', 'property', 'archive', 'MEDIUM', true),
        ('listing:read', 'Read provider listings', 'Read and list listings owned by the current provider.', 'Listing', 'listing', 'read', 'LOW', true),
        ('listing:create', 'Create listing', 'Create a draft listing from a provider-owned property.', 'Listing', 'listing', 'create', 'MEDIUM', true),
        ('listing:publish', 'Publish listing', 'Publish a draft listing owned by the current provider.', 'Listing', 'listing', 'publish', 'MEDIUM', true),
        ('listing:archive', 'Archive listing', 'Archive a listing owned by the current provider.', 'Listing', 'listing', 'archive', 'MEDIUM', true)
      ON CONFLICT (code) DO UPDATE SET
        name = EXCLUDED.name,
        description = EXCLUDED.description,
        category = EXCLUDED.category,
        resource = EXCLUDED.resource,
        action = EXCLUDED.action,
        risk_level = EXCLUDED.risk_level,
        is_assignable = EXCLUDED.is_assignable,
        deprecated_at = NULL,
        deleted_at = NULL,
        updated_at = CURRENT_TIMESTAMP
    `);

    await queryRunner.query(`
      INSERT INTO tbl_provider_role_permission (role_id, permission_id)
      SELECT role.id, permission.id
      FROM tbl_provider_role role
      CROSS JOIN tbl_provider_permission permission
      WHERE role.code = 'OWNER'
        AND role.status = 'ACTIVE'
        AND role.deleted_at IS NULL
        AND permission.code IN (
          'property:read',
          'property:create',
          'property:update',
          'property:archive',
          'listing:read',
          'listing:create',
          'listing:publish',
          'listing:archive'
        )
        AND permission.deleted_at IS NULL
        AND permission.deprecated_at IS NULL
      ON CONFLICT (role_id, permission_id) DO NOTHING
    `);

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

    if (!memberRoleId) {
      const insertedMemberRoles = (await queryRunner.query(`
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
        RETURNING id::text AS id
      `)) as { id: string }[];

      if (insertedMemberRoles.length === 0) {
        const concurrentMemberRoles = (await queryRunner.query(`
          SELECT id::text AS id
          FROM tbl_provider_role
          WHERE code = 'MEMBER'
          LIMIT 1
        `)) as { id: string }[];
        const concurrentRoleBackfill = (await queryRunner.query(
          `
            SELECT role_id::text AS role_id
            FROM tbl_provider_supply_member_role_backfill
            WHERE role_id = $1
          `,
          [concurrentMemberRoles[0]?.id],
        )) as { role_id: string }[];

        if (
          concurrentMemberRoles.length === 0 ||
          concurrentRoleBackfill.length === 0
        ) {
          throw new Error(
            'Provider supply permission migration refused to reuse an existing MEMBER role that is not owned by this migration.',
          );
        }

        memberRoleId = concurrentMemberRoles[0].id;
      } else {
        memberRoleId = insertedMemberRoles[0].id;
        await queryRunner.query(
          `
            INSERT INTO tbl_provider_supply_member_role_backfill (role_id)
            VALUES ($1)
            ON CONFLICT (role_id) DO NOTHING
          `,
          [memberRoleId],
        );
      }
    }

    await queryRunner.query(
      `
      INSERT INTO tbl_provider_supply_member_permission_backfill
        (role_id, permission_id)
      SELECT role.id, permission.id
      FROM tbl_provider_role role
      CROSS JOIN tbl_provider_permission permission
      WHERE role.id = $1
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
    `,
      [memberRoleId],
    );

    await queryRunner.query(`
      INSERT INTO tbl_provider_role_permission (role_id, permission_id)
      SELECT role_id, permission_id
      FROM tbl_provider_supply_member_permission_backfill
      ON CONFLICT (role_id, permission_id) DO NOTHING
    `);

    await queryRunner.query(
      `
      INSERT INTO tbl_provider_supply_member_assignment_backfill
        (membership_id, role_id)
      SELECT membership.id, role.id
      FROM tbl_provider_membership membership
      INNER JOIN tbl_provider_account provider
        ON provider.id = membership.provider_id
      INNER JOIN tbl_provider_role role
        ON role.id = $1
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
    `,
      [memberRoleId],
    );

    await queryRunner.query(`
      INSERT INTO tbl_provider_membership_role (membership_id, role_id)
      SELECT membership_id, role_id
      FROM tbl_provider_supply_member_assignment_backfill
      ON CONFLICT (membership_id, role_id) DO NOTHING
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const bookkeepingTables = (await queryRunner.query(`
      SELECT
        to_regclass('public.tbl_provider_supply_member_role_backfill') IS NOT NULL AS role_backfill_exists,
        to_regclass('public.tbl_provider_supply_member_permission_backfill') IS NOT NULL AS permission_backfill_exists,
        to_regclass('public.tbl_provider_supply_member_assignment_backfill') IS NOT NULL AS assignment_backfill_exists
    `)) as {
      role_backfill_exists: boolean;
      permission_backfill_exists: boolean;
      assignment_backfill_exists: boolean;
    }[];

    if (
      !bookkeepingTables[0]?.role_backfill_exists ||
      !bookkeepingTables[0]?.permission_backfill_exists ||
      !bookkeepingTables[0]?.assignment_backfill_exists
    ) {
      throw new Error(
        'Cannot rollback provider supply MEMBER migration because migration bookkeeping is incomplete.',
      );
    }

    const ownedMemberRoles = (await queryRunner.query(`
      SELECT role.id::text AS role_id
      FROM tbl_provider_supply_member_role_backfill backfill
      INNER JOIN tbl_provider_role role
        ON role.id = backfill.role_id
      WHERE role.code = 'MEMBER'
    `)) as { role_id: string }[];

    if (ownedMemberRoles.length !== 1) {
      throw new Error(
        'Cannot rollback provider supply MEMBER migration because the migration-owned MEMBER role provenance is missing or ambiguous.',
      );
    }

    const memberRoleId = ownedMemberRoles[0].role_id;
    const externalAssignments = (await queryRunner.query(
      `
        SELECT assignment.membership_id::text AS membership_id
        FROM tbl_provider_membership_role assignment
        WHERE assignment.role_id = $1
          AND NOT EXISTS (
            SELECT 1
            FROM tbl_provider_supply_member_assignment_backfill backfill
            WHERE backfill.membership_id = assignment.membership_id
              AND backfill.role_id = assignment.role_id
          )
        LIMIT 1
      `,
      [memberRoleId],
    )) as { membership_id: string }[];

    if (externalAssignments.length > 0) {
      throw new Error(
        'Cannot rollback provider supply MEMBER migration because MEMBER has runtime-owned membership assignments.',
      );
    }

    const externalPermissionMappings = (await queryRunner.query(
      `
        SELECT mapping.permission_id::text AS permission_id
        FROM tbl_provider_role_permission mapping
        WHERE mapping.role_id = $1
          AND NOT EXISTS (
            SELECT 1
            FROM tbl_provider_supply_member_permission_backfill backfill
            WHERE backfill.role_id = mapping.role_id
              AND backfill.permission_id = mapping.permission_id
          )
        LIMIT 1
      `,
      [memberRoleId],
    )) as { permission_id: string }[];

    if (externalPermissionMappings.length > 0) {
      throw new Error(
        'Cannot rollback provider supply MEMBER migration because MEMBER has runtime-owned permission mappings.',
      );
    }

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
    `);

    await queryRunner.query(`
      DELETE FROM tbl_provider_role role
      USING tbl_provider_supply_member_role_backfill backfill
      WHERE role.id = backfill.role_id
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

    await queryRunner.query(`
      DELETE FROM tbl_provider_role_permission mapping
      USING tbl_provider_supply_read_permission_backfill backfill
      WHERE mapping.role_id = backfill.role_id
        AND mapping.permission_id = backfill.permission_id
    `);
    await queryRunner.query(
      'DROP TABLE IF EXISTS tbl_provider_supply_read_permission_backfill',
    );

    await queryRunner.query(`
      DELETE FROM tbl_provider_role_permission mapping
      USING tbl_provider_role role, tbl_provider_permission permission
      WHERE mapping.role_id = role.id
        AND mapping.permission_id = permission.id
        AND role.code = 'OWNER'
        AND permission.code IN (
          'property:read',
          'property:create',
          'property:update',
          'property:archive',
          'listing:read',
          'listing:create',
          'listing:publish',
          'listing:archive'
        )
    `);

    await queryRunner.query(`
      DELETE FROM tbl_provider_permission permission
      WHERE permission.code IN (
        'property:read',
        'property:create',
        'property:update',
        'property:archive',
        'listing:read',
        'listing:create',
        'listing:publish',
        'listing:archive'
      )
        AND NOT EXISTS (
          SELECT 1
          FROM tbl_provider_role_permission mapping
          WHERE mapping.permission_id = permission.id
        )
    `);
  }
}
