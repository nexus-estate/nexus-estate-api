import { MigrationInterface, QueryRunner, TableForeignKey } from 'typeorm';

import { BcryptService } from '../../../../common/security/bcrypt.service';

const MIGRATION_CREATED_BY =
  'migration:1789312966656-AddAuthorizationIntegrityAndInitializeSuperAdmin';
const DEFAULT_SUPER_ADMIN_EMAIL = 'superadmin@nexus-estate.local';
const DEFAULT_SUPER_ADMIN_PASSWORD = 'NexusEstate#SuperAdmin2026!';

type ConstraintSpec = {
  tableName: string;
  constraintName: string;
  expression: string;
  requiredTerms: readonly string[];
};

type IndexSpec = {
  tableName: string;
  indexName: string;
  columnNames: readonly string[];
};

const CHECK_CONSTRAINTS: readonly ConstraintSpec[] = [
  {
    tableName: 'tbl_marketplace_role',
    constraintName: 'chk_marketplace_role_status',
    expression: `status IN ('ACTIVE', 'DISABLED')`,
    requiredTerms: ['ACTIVE', 'DISABLED'],
  },
  {
    tableName: 'tbl_marketplace_role',
    constraintName: 'chk_marketplace_role_version_positive',
    expression: 'version >= 1',
    requiredTerms: ['VERSION', '>= 1'],
  },
  {
    tableName: 'tbl_provider_role',
    constraintName: 'chk_provider_role_status',
    expression: `status IN ('ACTIVE', 'DISABLED')`,
    requiredTerms: ['ACTIVE', 'DISABLED'],
  },
  {
    tableName: 'tbl_provider_role',
    constraintName: 'chk_provider_role_version_positive',
    expression: 'version >= 1',
    requiredTerms: ['VERSION', '>= 1'],
  },
  {
    tableName: 'tbl_administration_role',
    constraintName: 'chk_administration_role_status',
    expression: `status IN ('ACTIVE', 'DISABLED')`,
    requiredTerms: ['ACTIVE', 'DISABLED'],
  },
  {
    tableName: 'tbl_administration_role',
    constraintName: 'chk_administration_role_version_positive',
    expression: 'version >= 1',
    requiredTerms: ['VERSION', '>= 1'],
  },
  {
    tableName: 'tbl_marketplace_permission',
    constraintName: 'chk_marketplace_permission_risk_level',
    expression: `risk_level IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')`,
    requiredTerms: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'],
  },
  {
    tableName: 'tbl_provider_permission',
    constraintName: 'chk_provider_permission_risk_level',
    expression: `risk_level IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')`,
    requiredTerms: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'],
  },
  {
    tableName: 'tbl_administration_permission',
    constraintName: 'chk_administration_permission_risk_level',
    expression: `risk_level IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')`,
    requiredTerms: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'],
  },
  {
    tableName: 'tbl_provider_membership',
    constraintName: 'chk_provider_membership_status',
    expression: `status IN ('ACTIVE', 'SUSPENDED', 'REMOVED')`,
    requiredTerms: ['ACTIVE', 'SUSPENDED', 'REMOVED'],
  },
];

const INDEXES: readonly IndexSpec[] = [
  {
    tableName: 'tbl_authorization_audit_log',
    indexName: 'idx_authorization_audit_actor_created_at',
    columnNames: ['actor_administrator_id', 'created_at'],
  },
  {
    tableName: 'tbl_authorization_audit_log',
    indexName: 'idx_authorization_audit_action_created_at',
    columnNames: ['action', 'created_at'],
  },
  {
    tableName: 'tbl_authorization_audit_log',
    indexName: 'idx_authorization_audit_target_created_at',
    columnNames: ['target_type', 'target_id', 'created_at'],
  },
  {
    tableName: 'tbl_provider_membership',
    indexName: 'idx_provider_membership_customer_provider_status',
    columnNames: ['customer_id', 'provider_id', 'status'],
  },
];

/**
 * Enforces the database contracts required by platform authorization and
 * creates the initial Administration recovery identity.
 *
 * Use this migration after the platform authorization tables exist. It
 * deliberately validates the expected table shape before adding constraints,
 * so an accidentally partial deployment fails instead of being marked as
 * successfully upgraded. The initial account is configurable through
 * `INITIAL_ADMIN_EMAIL` and `INITIAL_ADMIN_PASSWORD`; local/test defaults are
 * provided for a fresh database.
 */
export class AddAuthorizationIntegrityAndInitializeSuperAdmin1789312966656 implements MigrationInterface {
  /**
   * Validates the authorization schema, adds integrity/index contracts, and
   * provisions an idempotent Super Admin assignment in one migration unit.
   */
  public async up(queryRunner: QueryRunner): Promise<void> {
    await this.assertSchemaShape(queryRunner);
    await this.ensureAssignedByForeignKey(
      queryRunner,
      'tbl_customer_role_assignment',
      'fk_customer_role_assignment_assigned_by',
    );
    await this.ensureAssignedByForeignKey(
      queryRunner,
      'tbl_provider_membership_role',
      'fk_provider_membership_role_assigned_by',
    );

    for (const constraint of CHECK_CONSTRAINTS) {
      await this.ensureCheckConstraint(queryRunner, constraint);
    }
    for (const index of INDEXES) {
      await this.ensureIndex(queryRunner, index);
    }

    await this.ensureSuperAdministrator(queryRunner);
  }

  /**
   * Removes only constraints and indexes introduced here. The operational
   * administrator is retained unless this migration itself created it, which
   * prevents rollback from deleting an account that already existed.
   */
  public async down(queryRunner: QueryRunner): Promise<void> {
    const email = this.superAdminEmail();
    await queryRunner.query(
      `DELETE FROM tbl_administrator_role_assignment assignment
       USING tbl_administrator_account administrator
       WHERE assignment.administrator_id = administrator.id
         AND administrator.email = $1
         AND administrator.created_by = $2`,
      [email, MIGRATION_CREATED_BY],
    );
    await queryRunner.query(
      `DELETE FROM tbl_administrator_account
       WHERE email = $1 AND created_by = $2`,
      [email, MIGRATION_CREATED_BY],
    );

    for (const index of [...INDEXES].reverse()) {
      await queryRunner.query(`DROP INDEX IF EXISTS "${index.indexName}"`);
    }
    for (const constraint of [...CHECK_CONSTRAINTS].reverse()) {
      await queryRunner.query(
        `ALTER TABLE "${constraint.tableName}" DROP CONSTRAINT IF EXISTS "${constraint.constraintName}"`,
      );
    }
    for (const [tableName, foreignKeyName] of [
      [
        'tbl_provider_membership_role',
        'fk_provider_membership_role_assigned_by',
      ],
      [
        'tbl_customer_role_assignment',
        'fk_customer_role_assignment_assigned_by',
      ],
    ] as const) {
      await queryRunner.query(
        `ALTER TABLE "${tableName}" DROP CONSTRAINT IF EXISTS "${foreignKeyName}"`,
      );
    }
  }

  /** Fails visibly when a required table or column is absent or incompatible. */
  private async assertSchemaShape(queryRunner: QueryRunner): Promise<void> {
    const contracts: Readonly<Record<string, readonly string[]>> = {
      tbl_administrator_account: ['id', 'email', 'password', 'is_active'],
      tbl_administrator_role_assignment: [
        'administrator_id',
        'role_id',
        'assigned_by_admin_id',
      ],
      tbl_administration_role: ['id', 'code', 'status', 'version'],
      tbl_administration_permission: ['id', 'code', 'risk_level'],
      tbl_administration_role_permission: ['role_id', 'permission_id'],
      tbl_marketplace_role: ['id', 'code', 'status', 'version'],
      tbl_marketplace_permission: ['id', 'code', 'risk_level'],
      tbl_customer_role_assignment: [
        'customer_id',
        'role_id',
        'assigned_by_admin_id',
      ],
      tbl_provider_role: ['id', 'code', 'status', 'version'],
      tbl_provider_permission: ['id', 'code', 'risk_level'],
      tbl_provider_membership: ['id', 'customer_id', 'provider_id', 'status'],
      tbl_provider_membership_role: [
        'membership_id',
        'role_id',
        'assigned_by_admin_id',
      ],
      tbl_authorization_audit_log: [
        'actor_administrator_id',
        'platform',
        'action',
        'target_type',
        'target_id',
        'created_at',
      ],
    };

    for (const [tableName, requiredColumns] of Object.entries(contracts)) {
      const table = await queryRunner.getTable(tableName);
      if (!table) {
        throw new Error(
          `Authorization migration preflight failed: missing table ${tableName}`,
        );
      }
      const actualColumns = new Set(table.columns.map((column) => column.name));
      const missingColumns = requiredColumns.filter(
        (columnName) => !actualColumns.has(columnName),
      );
      if (missingColumns.length > 0) {
        throw new Error(
          `Authorization migration preflight failed: ${tableName} is missing ${missingColumns.join(', ')}`,
        );
      }
    }
  }

  /** Adds the nullable administrator provenance FK with historical-safe deletion. */
  private async ensureAssignedByForeignKey(
    queryRunner: QueryRunner,
    tableName: string,
    foreignKeyName: string,
  ): Promise<void> {
    const table = await queryRunner.getTable(tableName);
    const existing = table?.foreignKeys.find(
      (foreignKey) => foreignKey.name === foreignKeyName,
    );
    if (existing) {
      const isExpected =
        existing.columnNames.length === 1 &&
        existing.columnNames[0] === 'assigned_by_admin_id' &&
        existing.referencedTableName === 'tbl_administrator_account' &&
        existing.referencedColumnNames[0] === 'id' &&
        existing.onDelete === 'SET NULL';
      if (!isExpected) {
        throw new Error(
          `Authorization migration preflight failed: ${foreignKeyName} has an unexpected definition`,
        );
      }
      return;
    }

    await queryRunner.createForeignKey(
      tableName,
      new TableForeignKey({
        name: foreignKeyName,
        columnNames: ['assigned_by_admin_id'],
        referencedTableName: 'tbl_administrator_account',
        referencedColumnNames: ['id'],
        onDelete: 'SET NULL',
      }),
    );
  }

  /** Adds or validates a named CHECK constraint for a known upgrade path. */
  private async ensureCheckConstraint(
    queryRunner: QueryRunner,
    constraint: ConstraintSpec,
  ): Promise<void> {
    const rows = (await queryRunner.query(
      `SELECT pg_get_constraintdef(c.oid) AS definition
       FROM pg_constraint c
       INNER JOIN pg_class table_info ON table_info.oid = c.conrelid
       WHERE table_info.relname = $1 AND c.conname = $2`,
      [constraint.tableName, constraint.constraintName],
    )) as { definition: string }[];
    if (rows[0]) {
      const definition = rows[0].definition.toUpperCase();
      if (
        !constraint.requiredTerms.every((term) =>
          definition.includes(term.toUpperCase()),
        )
      ) {
        throw new Error(
          `Authorization migration preflight failed: ${constraint.constraintName} has an unexpected definition`,
        );
      }
      return;
    }

    await queryRunner.query(
      `ALTER TABLE "${constraint.tableName}" ADD CONSTRAINT "${constraint.constraintName}" CHECK (${constraint.expression})`,
    );
  }

  /** Adds an index only after checking whether an existing named index matches. */
  private async ensureIndex(
    queryRunner: QueryRunner,
    index: IndexSpec,
  ): Promise<void> {
    const rows = (await queryRunner.query(
      `SELECT pg_get_indexdef(index_info.indexrelid) AS definition
       FROM pg_stat_user_indexes index_info
       WHERE index_info.relname = $1 AND index_info.indexrelname = $2`,
      [index.tableName, index.indexName],
    )) as { definition: string }[];
    if (rows[0]) {
      const definition = rows[0].definition.toLowerCase();
      if (
        !index.columnNames.every((columnName) =>
          definition.includes(columnName),
        )
      ) {
        throw new Error(
          `Authorization migration preflight failed: ${index.indexName} has an unexpected definition`,
        );
      }
      return;
    }

    const columns = index.columnNames
      .map((columnName) => `"${columnName}"`)
      .join(', ');
    await queryRunner.query(
      `CREATE INDEX "${index.indexName}" ON "${index.tableName}" (${columns})`,
    );
  }

  /** Creates or reuses the initial administration recovery identity. */
  private async ensureSuperAdministrator(
    queryRunner: QueryRunner,
  ): Promise<void> {
    const roleRows = (await queryRunner.query(
      `SELECT id FROM tbl_administration_role
       WHERE code = 'SUPER_ADMIN' AND deleted_at IS NULL
       LIMIT 1`,
    )) as { id: string }[];
    const role = roleRows[0];
    if (!role) {
      throw new Error(
        'Authorization migration failed: SUPER_ADMIN role is not available',
      );
    }

    await queryRunner.query(
      `UPDATE tbl_administration_role
       SET is_system = true, status = 'ACTIVE', deleted_at = NULL,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [role.id],
    );
    await queryRunner.query(
      `INSERT INTO tbl_administration_role_permission (role_id, permission_id)
       SELECT $1, permission.id
       FROM tbl_administration_permission permission
       WHERE permission.deleted_at IS NULL
       ON CONFLICT (role_id, permission_id) DO NOTHING`,
      [role.id],
    );

    const email = this.superAdminEmail();
    const password = this.superAdminPassword();
    const existingRows = (await queryRunner.query(
      `SELECT id, deleted_at FROM tbl_administrator_account WHERE email = $1 LIMIT 1`,
      [email],
    )) as { id: string; deleted_at: Date | null }[];
    let administratorId = existingRows[0]?.id;

    if (!administratorId) {
      const passwordHash = await new BcryptService().hash(password);
      const insertedRows = (await queryRunner.query(
        `INSERT INTO tbl_administrator_account
           (email, password, is_active, created_by, updated_by)
         VALUES ($1, $2, true, $3, $3)
         RETURNING id`,
        [email, passwordHash, MIGRATION_CREATED_BY],
      )) as { id: string }[];
      administratorId = insertedRows[0]?.id;
    } else if (existingRows[0]?.deleted_at) {
      /** A soft-deleted seed identity must be recoverable on a fresh deployment. */
      const passwordHash = await new BcryptService().hash(password);
      await queryRunner.query(
        `UPDATE tbl_administrator_account
         SET password = $2, is_active = true, deleted_at = NULL,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $1`,
        [administratorId, passwordHash],
      );
    }

    if (!administratorId) {
      throw new Error(
        'Authorization migration failed: Super Admin account could not be created',
      );
    }
    await queryRunner.query(
      `INSERT INTO tbl_administrator_role_assignment
         (administrator_id, role_id, assigned_by_admin_id)
       VALUES ($1, $2, NULL)
       ON CONFLICT (administrator_id, role_id) DO NOTHING`,
      [administratorId, role.id],
    );
  }

  /** Returns a normalized, configurable seed email. */
  private superAdminEmail(): string {
    if (
      process.env.NODE_ENV === 'production' &&
      !process.env.INITIAL_ADMIN_EMAIL?.trim()
    ) {
      throw new Error(
        'Authorization migration failed: INITIAL_ADMIN_EMAIL is required in production',
      );
    }
    return (
      process.env.INITIAL_ADMIN_EMAIL?.trim().toLowerCase() ||
      DEFAULT_SUPER_ADMIN_EMAIL
    );
  }

  /** Returns the configured seed password, with an explicit local default. */
  private superAdminPassword(): string {
    if (
      process.env.NODE_ENV === 'production' &&
      !process.env.INITIAL_ADMIN_PASSWORD
    ) {
      throw new Error(
        'Authorization migration failed: INITIAL_ADMIN_PASSWORD is required in production',
      );
    }
    return process.env.INITIAL_ADMIN_PASSWORD || DEFAULT_SUPER_ADMIN_PASSWORD;
  }
}
