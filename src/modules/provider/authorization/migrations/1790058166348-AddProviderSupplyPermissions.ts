import { MigrationInterface, QueryRunner } from 'typeorm';

/** Adds the code-owned supply capabilities and gives them to the system OWNER role. */
export class AddProviderSupplyPermissions1790058166348 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
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
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Rollback is safe only for the OWNER mappings introduced by this slice;
    // permissions still referenced by another role remain in the catalogue.
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
