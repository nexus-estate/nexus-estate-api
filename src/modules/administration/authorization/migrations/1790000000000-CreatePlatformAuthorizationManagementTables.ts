import { MigrationInterface, QueryRunner } from 'typeorm';

/** Expands IA-01 with platform-owned authorization management persistence. */
export class CreatePlatformAuthorizationManagementTables1790000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE tbl_administration_role
        ADD COLUMN IF NOT EXISTS status varchar(16) NOT NULL DEFAULT 'ACTIVE',
        ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 1
    `);
    await queryRunner.query(`
      ALTER TABLE tbl_administration_permission
        ADD COLUMN IF NOT EXISTS name varchar(255) NOT NULL DEFAULT '',
        ADD COLUMN IF NOT EXISTS category varchar(100) NOT NULL DEFAULT 'Administration',
        ADD COLUMN IF NOT EXISTS resource varchar(100) NOT NULL DEFAULT 'authorization',
        ADD COLUMN IF NOT EXISTS action varchar(100) NOT NULL DEFAULT 'manage',
        ADD COLUMN IF NOT EXISTS risk_level varchar(16) NOT NULL DEFAULT 'MEDIUM',
        ADD COLUMN IF NOT EXISTS is_assignable boolean NOT NULL DEFAULT true,
        ADD COLUMN IF NOT EXISTS deprecated_at timestamp NULL
    `);
    await queryRunner.query(`
      UPDATE tbl_administration_role
      SET status = COALESCE(status, 'ACTIVE'), version = COALESCE(version, 1)
    `);
    await queryRunner.query(`
      UPDATE tbl_administration_permission
      SET
        name = CASE WHEN name = '' THEN code ELSE name END,
        resource = regexp_replace(code, ':[^:]+$', ''),
        action = regexp_replace(code, '^.*:', '')
      WHERE name = '' OR resource = 'authorization' OR action = 'manage'
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS tbl_marketplace_role (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        code varchar(100) NOT NULL,
        name varchar(255) NOT NULL,
        description text NULL,
        is_system boolean NOT NULL DEFAULT false,
        status varchar(16) NOT NULL DEFAULT 'ACTIVE',
        version integer NOT NULL DEFAULT 1,
        created_at timestamp NOT NULL DEFAULT now(),
        updated_at timestamp NOT NULL DEFAULT now(),
        deleted_at timestamp NULL,
        created_by varchar NULL,
        updated_by varchar NULL,
        CONSTRAINT uq_marketplace_role_code UNIQUE (code)
      )
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS tbl_marketplace_permission (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        code varchar(150) NOT NULL,
        name varchar(255) NOT NULL,
        description text NOT NULL,
        category varchar(100) NOT NULL,
        resource varchar(100) NOT NULL,
        action varchar(100) NOT NULL,
        risk_level varchar(16) NOT NULL,
        is_assignable boolean NOT NULL DEFAULT true,
        deprecated_at timestamp NULL,
        created_at timestamp NOT NULL DEFAULT now(),
        updated_at timestamp NOT NULL DEFAULT now(),
        deleted_at timestamp NULL,
        created_by varchar NULL,
        updated_by varchar NULL,
        CONSTRAINT uq_marketplace_permission_code UNIQUE (code)
      )
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS tbl_marketplace_role_permission (
        role_id uuid NOT NULL,
        permission_id uuid NOT NULL,
        PRIMARY KEY (role_id, permission_id),
        CONSTRAINT fk_marketplace_role_permission_role
          FOREIGN KEY (role_id) REFERENCES tbl_marketplace_role(id) ON DELETE CASCADE,
        CONSTRAINT fk_marketplace_role_permission_permission
          FOREIGN KEY (permission_id) REFERENCES tbl_marketplace_permission(id) ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_marketplace_role_permission_permission_id
        ON tbl_marketplace_role_permission(permission_id)
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS tbl_customer_role_assignment (
        customer_id uuid NOT NULL,
        role_id uuid NOT NULL,
        assigned_at timestamp NOT NULL DEFAULT now(),
        assigned_by_admin_id uuid NULL,
        reason text NULL,
        PRIMARY KEY (customer_id, role_id),
        CONSTRAINT fk_customer_role_assignment_customer
          FOREIGN KEY (customer_id) REFERENCES tbl_customer_account(id) ON DELETE RESTRICT,
        CONSTRAINT fk_customer_role_assignment_role
          FOREIGN KEY (role_id) REFERENCES tbl_marketplace_role(id) ON DELETE RESTRICT
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_customer_role_assignment_role_id ON tbl_customer_role_assignment(role_id)`,
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS tbl_provider_membership (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        provider_id uuid NOT NULL,
        customer_id uuid NOT NULL,
        status varchar(16) NOT NULL DEFAULT 'ACTIVE',
        joined_at timestamp NOT NULL DEFAULT now(),
        created_at timestamp NOT NULL DEFAULT now(),
        updated_at timestamp NOT NULL DEFAULT now(),
        deleted_at timestamp NULL,
        created_by varchar NULL,
        updated_by varchar NULL,
        CONSTRAINT uq_provider_membership_provider_customer UNIQUE (provider_id, customer_id),
        CONSTRAINT fk_provider_membership_provider
          FOREIGN KEY (provider_id) REFERENCES tbl_provider_account(id) ON DELETE RESTRICT,
        CONSTRAINT fk_provider_membership_customer
          FOREIGN KEY (customer_id) REFERENCES tbl_customer_account(id) ON DELETE RESTRICT
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_provider_membership_provider_id
        ON tbl_provider_membership(provider_id)
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_provider_membership_customer_id
        ON tbl_provider_membership(customer_id)
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS tbl_provider_role (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        code varchar(100) NOT NULL,
        name varchar(255) NOT NULL,
        description text NULL,
        is_system boolean NOT NULL DEFAULT false,
        status varchar(16) NOT NULL DEFAULT 'ACTIVE',
        version integer NOT NULL DEFAULT 1,
        created_at timestamp NOT NULL DEFAULT now(),
        updated_at timestamp NOT NULL DEFAULT now(),
        deleted_at timestamp NULL,
        created_by varchar NULL,
        updated_by varchar NULL,
        CONSTRAINT uq_provider_role_code UNIQUE (code)
      )
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS tbl_provider_permission (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        code varchar(150) NOT NULL,
        name varchar(255) NOT NULL,
        description text NOT NULL,
        category varchar(100) NOT NULL,
        resource varchar(100) NOT NULL,
        action varchar(100) NOT NULL,
        risk_level varchar(16) NOT NULL,
        is_assignable boolean NOT NULL DEFAULT true,
        deprecated_at timestamp NULL,
        created_at timestamp NOT NULL DEFAULT now(),
        updated_at timestamp NOT NULL DEFAULT now(),
        deleted_at timestamp NULL,
        created_by varchar NULL,
        updated_by varchar NULL,
        CONSTRAINT uq_provider_permission_code UNIQUE (code)
      )
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS tbl_provider_role_permission (
        role_id uuid NOT NULL,
        permission_id uuid NOT NULL,
        PRIMARY KEY (role_id, permission_id),
        CONSTRAINT fk_provider_role_permission_role
          FOREIGN KEY (role_id) REFERENCES tbl_provider_role(id) ON DELETE CASCADE,
        CONSTRAINT fk_provider_role_permission_permission
          FOREIGN KEY (permission_id) REFERENCES tbl_provider_permission(id) ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_provider_role_permission_permission_id ON tbl_provider_role_permission(permission_id)`,
    );
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS tbl_provider_membership_role (
        membership_id uuid NOT NULL,
        role_id uuid NOT NULL,
        assigned_at timestamp NOT NULL DEFAULT now(),
        assigned_by_admin_id uuid NULL,
        PRIMARY KEY (membership_id, role_id),
        CONSTRAINT fk_provider_membership_role_membership
          FOREIGN KEY (membership_id) REFERENCES tbl_provider_membership(id) ON DELETE RESTRICT,
        CONSTRAINT fk_provider_membership_role_role
          FOREIGN KEY (role_id) REFERENCES tbl_provider_role(id) ON DELETE RESTRICT
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_provider_membership_role_role_id ON tbl_provider_membership_role(role_id)`,
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS tbl_authorization_audit_log (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        actor_administrator_id uuid NOT NULL,
        platform varchar(32) NOT NULL,
        action varchar(64) NOT NULL,
        target_type varchar(64) NOT NULL,
        target_id uuid NULL,
        reason text NULL,
        before_state jsonb NULL,
        after_state jsonb NULL,
        request_id varchar(255) NULL,
        created_at timestamp NOT NULL DEFAULT now(),
        updated_at timestamp NOT NULL DEFAULT now(),
        CONSTRAINT fk_authorization_audit_actor
          FOREIGN KEY (actor_administrator_id) REFERENCES tbl_administrator_account(id) ON DELETE RESTRICT
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_authorization_audit_platform_created_at
        ON tbl_authorization_audit_log(platform, created_at)
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_authorization_audit_target
        ON tbl_authorization_audit_log(target_type, target_id)
    `);

    await queryRunner.query(`
      INSERT INTO tbl_provider_role (code, name, description, is_system)
      VALUES ('OWNER', 'Owner', 'Provider account owner', true)
      ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name
    `);
    await queryRunner.query(`
      INSERT INTO tbl_provider_permission
        (code, name, description, category, resource, action, risk_level, is_assignable)
      VALUES
        ('provider-account:read', 'Read provider account', 'Read the provider account profile.', 'Provider Account', 'provider-account', 'read', 'LOW', true),
        ('provider-account:update', 'Update provider account', 'Update provider account profile.', 'Provider Account', 'provider-account', 'update', 'MEDIUM', true)
      ON CONFLICT (code) DO UPDATE
        SET name = EXCLUDED.name, description = EXCLUDED.description
    `);
    await queryRunner.query(`
      INSERT INTO tbl_provider_role_permission (role_id, permission_id)
      SELECT role.id, permission.id
      FROM tbl_provider_role role
      CROSS JOIN tbl_provider_permission permission
      WHERE role.code = 'OWNER'
      ON CONFLICT (role_id, permission_id) DO NOTHING
    `);
    await queryRunner.query(`
      UPDATE tbl_provider_membership membership
      SET status = 'ACTIVE', deleted_at = NULL, updated_at = CURRENT_TIMESTAMP
      FROM tbl_provider_account provider
      WHERE provider.id = membership.provider_id
        AND provider.owner_customer_id = membership.customer_id
        AND provider.deleted_at IS NULL
    `);
    await queryRunner.query(`
      INSERT INTO tbl_provider_membership (provider_id, customer_id, status)
      SELECT id, owner_customer_id, 'ACTIVE'
      FROM tbl_provider_account
      WHERE deleted_at IS NULL
      ON CONFLICT (provider_id, customer_id) DO NOTHING
    `);
    await queryRunner.query(`
      INSERT INTO tbl_provider_membership_role (membership_id, role_id)
      SELECT membership.id, role.id
      FROM tbl_provider_membership membership
      INNER JOIN tbl_provider_role role ON role.code = 'OWNER'
      INNER JOIN tbl_provider_account provider ON provider.id = membership.provider_id
      WHERE membership.customer_id = provider.owner_customer_id
      ON CONFLICT (membership_id, role_id) DO NOTHING
    `);

    await queryRunner.query(`
      INSERT INTO tbl_administration_permission
        (code, name, description, category, resource, action, risk_level, is_assignable)
      VALUES
        ('authorization:platform:read', 'Read authorization platforms', 'View authorization platform metadata.', 'Authorization', 'authorization:platform', 'read', 'CRITICAL', true),
        ('authorization:role:read', 'Read authorization roles', 'View platform roles and role details.', 'Authorization', 'authorization:role', 'read', 'CRITICAL', true),
        ('authorization:role:write', 'Manage authorization roles', 'Create, update, and delete platform roles.', 'Authorization', 'authorization:role', 'write', 'CRITICAL', true),
        ('authorization:permission:read', 'Read authorization permissions', 'View platform permission catalogues.', 'Authorization', 'authorization:permission', 'read', 'CRITICAL', true),
        ('authorization:assignment:read', 'Read authorization assignments', 'View platform subjects and role assignments.', 'Authorization', 'authorization:assignment', 'read', 'CRITICAL', true),
        ('authorization:assignment:write', 'Manage authorization assignments', 'Replace platform subject role assignments.', 'Authorization', 'authorization:assignment', 'write', 'CRITICAL', true),
        ('authorization:audit:read', 'Read authorization audit', 'View authorization mutation history.', 'Authorization', 'authorization:audit', 'read', 'CRITICAL', true)
      ON CONFLICT (code) DO UPDATE
        SET name = EXCLUDED.name, description = EXCLUDED.description,
            category = EXCLUDED.category, resource = EXCLUDED.resource,
            action = EXCLUDED.action, risk_level = EXCLUDED.risk_level,
            is_assignable = EXCLUDED.is_assignable
    `);
    await queryRunner.query(`
      INSERT INTO tbl_administration_role_permission (role_id, permission_id)
      SELECT role.id, permission.id
      FROM tbl_administration_role role
      CROSS JOIN tbl_administration_permission permission
      WHERE role.code = 'SUPER_ADMIN'
        AND permission.code LIKE 'authorization:%'
      ON CONFLICT (role_id, permission_id) DO NOTHING
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS tbl_authorization_audit_log');
    await queryRunner.query(
      'DROP TABLE IF EXISTS tbl_provider_membership_role',
    );
    await queryRunner.query(
      'DROP TABLE IF EXISTS tbl_provider_role_permission',
    );
    await queryRunner.query('DROP TABLE IF EXISTS tbl_provider_permission');
    await queryRunner.query('DROP TABLE IF EXISTS tbl_provider_role');
    await queryRunner.query('DROP TABLE IF EXISTS tbl_provider_membership');
    await queryRunner.query(
      'DROP TABLE IF EXISTS tbl_customer_role_assignment',
    );
    await queryRunner.query(
      'DROP TABLE IF EXISTS tbl_marketplace_role_permission',
    );
    await queryRunner.query('DROP TABLE IF EXISTS tbl_marketplace_permission');
    await queryRunner.query('DROP TABLE IF EXISTS tbl_marketplace_role');
    await queryRunner.query(
      `ALTER TABLE tbl_administration_permission
        DROP COLUMN IF EXISTS name,
        DROP COLUMN IF EXISTS category,
        DROP COLUMN IF EXISTS resource,
        DROP COLUMN IF EXISTS action,
        DROP COLUMN IF EXISTS risk_level,
        DROP COLUMN IF EXISTS is_assignable,
        DROP COLUMN IF EXISTS deprecated_at`,
    );
    await queryRunner.query(
      'ALTER TABLE tbl_administration_role DROP COLUMN IF EXISTS status, DROP COLUMN IF EXISTS version',
    );
  }
}
