import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableForeignKey,
  TableIndex,
} from 'typeorm';

/** Adds the administration-owned authorization schema during EXPAND. */
export class CreateAdministrationAuthorizationTables1789400000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'tbl_administration_role',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'uuid',
            default: 'gen_random_uuid()',
          },
          { name: 'code', type: 'varchar', length: '100', isNullable: false },
          { name: 'name', type: 'varchar', length: '255', isNullable: false },
          { name: 'description', type: 'text', isNullable: true },
          {
            name: 'is_system',
            type: 'boolean',
            isNullable: false,
            default: false,
          },
          { name: 'created_at', type: 'timestamp', default: 'now()' },
          { name: 'updated_at', type: 'timestamp', default: 'now()' },
          { name: 'deleted_at', type: 'timestamp', isNullable: true },
          { name: 'created_by', type: 'varchar', isNullable: true },
          { name: 'updated_by', type: 'varchar', isNullable: true },
        ],
        indices: [
          new TableIndex({
            name: 'uq_administration_role_code',
            columnNames: ['code'],
            isUnique: true,
          }),
        ],
      }),
      true,
    );

    await queryRunner.createTable(
      new Table({
        name: 'tbl_administration_permission',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'uuid',
            default: 'gen_random_uuid()',
          },
          {
            name: 'code',
            type: 'varchar',
            length: '150',
            isNullable: false,
          },
          { name: 'description', type: 'text', isNullable: true },
          { name: 'created_at', type: 'timestamp', default: 'now()' },
          { name: 'updated_at', type: 'timestamp', default: 'now()' },
          { name: 'deleted_at', type: 'timestamp', isNullable: true },
          { name: 'created_by', type: 'varchar', isNullable: true },
          { name: 'updated_by', type: 'varchar', isNullable: true },
        ],
        indices: [
          new TableIndex({
            name: 'uq_administration_permission_code',
            columnNames: ['code'],
            isUnique: true,
          }),
        ],
      }),
      true,
    );

    await queryRunner.createTable(
      new Table({
        name: 'tbl_administration_role_permission',
        columns: [
          { name: 'role_id', type: 'uuid', isPrimary: true },
          { name: 'permission_id', type: 'uuid', isPrimary: true },
        ],
        indices: [
          new TableIndex({
            name: 'idx_administration_role_permission_permission_id',
            columnNames: ['permission_id'],
          }),
        ],
        foreignKeys: [
          new TableForeignKey({
            name: 'fk_administration_role_permission_role',
            columnNames: ['role_id'],
            referencedTableName: 'tbl_administration_role',
            referencedColumnNames: ['id'],
            onDelete: 'RESTRICT',
          }),
          new TableForeignKey({
            name: 'fk_administration_role_permission_permission',
            columnNames: ['permission_id'],
            referencedTableName: 'tbl_administration_permission',
            referencedColumnNames: ['id'],
            onDelete: 'RESTRICT',
          }),
        ],
      }),
      true,
    );

    await queryRunner.createTable(
      new Table({
        name: 'tbl_administrator_role_assignment',
        columns: [
          { name: 'administrator_id', type: 'uuid', isPrimary: true },
          { name: 'role_id', type: 'uuid', isPrimary: true },
          { name: 'assigned_at', type: 'timestamp', default: 'now()' },
          { name: 'assigned_by_admin_id', type: 'uuid', isNullable: true },
        ],
        indices: [
          new TableIndex({
            name: 'idx_administrator_role_assignment_role_id',
            columnNames: ['role_id'],
          }),
        ],
        foreignKeys: [
          new TableForeignKey({
            name: 'fk_administrator_role_assignment_admin',
            columnNames: ['administrator_id'],
            referencedTableName: 'tbl_administrator_account',
            referencedColumnNames: ['id'],
            onDelete: 'RESTRICT',
          }),
          new TableForeignKey({
            name: 'fk_administrator_role_assignment_role',
            columnNames: ['role_id'],
            referencedTableName: 'tbl_administration_role',
            referencedColumnNames: ['id'],
            onDelete: 'RESTRICT',
          }),
          new TableForeignKey({
            name: 'fk_administrator_role_assignment_assigned_by',
            columnNames: ['assigned_by_admin_id'],
            referencedTableName: 'tbl_administrator_account',
            referencedColumnNames: ['id'],
            onDelete: 'SET NULL',
          }),
        ],
      }),
      true,
    );

    await queryRunner.query(`
      INSERT INTO tbl_administration_role (code, name, description, is_system)
      VALUES
        ('SUPER_ADMIN', 'Super administrator', 'Full administration access', true),
        ('PROVIDER_REVIEWER', 'Provider reviewer', 'Reviews provider-account onboarding', true)
      ON CONFLICT (code) DO UPDATE
        SET name = EXCLUDED.name,
            description = EXCLUDED.description,
            is_system = EXCLUDED.is_system
    `);

    await queryRunner.query(`
      INSERT INTO tbl_administration_permission (code, description)
      VALUES
        ('admin-portal:access', 'Access the internal administration portal'),
        ('provider-account:read', 'Read provider-account information'),
        ('provider-account:approve', 'Approve provider-account onboarding'),
        ('provider-account:suspend', 'Suspend a provider account'),
        ('provider-account:reject', 'Reject provider-account onboarding'),
        ('metrics:read', 'Read administration metrics')
      ON CONFLICT (code) DO UPDATE
        SET description = EXCLUDED.description
    `);

    await queryRunner.query(`
      INSERT INTO tbl_administration_role_permission (role_id, permission_id)
      SELECT role.id, permission.id
      FROM tbl_administration_role role
      CROSS JOIN tbl_administration_permission permission
      WHERE role.code = 'SUPER_ADMIN'
      ON CONFLICT (role_id, permission_id) DO NOTHING
    `);

    await queryRunner.query(`
      INSERT INTO tbl_administration_role_permission (role_id, permission_id)
      SELECT role.id, permission.id
      FROM tbl_administration_role role
      INNER JOIN tbl_administration_permission permission
        ON permission.code IN (
          'admin-portal:access',
          'provider-account:read',
          'provider-account:approve'
        )
      WHERE role.code = 'PROVIDER_REVIEWER'
      ON CONFLICT (role_id, permission_id) DO NOTHING
    `);

    for (const tableName of [
      'tbl_customer_account',
      'tbl_administrator_account',
    ]) {
      if (await queryRunner.hasTable(tableName)) {
        await queryRunner.query(
          `ALTER TABLE ${tableName} ALTER COLUMN role_id DROP NOT NULL`,
        );
      }
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable(
      'tbl_administrator_role_assignment',
      true,
      true,
      true,
    );
    await queryRunner.dropTable(
      'tbl_administration_role_permission',
      true,
      true,
      true,
    );
    await queryRunner.dropTable(
      'tbl_administration_permission',
      true,
      true,
      true,
    );
    await queryRunner.dropTable('tbl_administration_role', true, true, true);
  }
}
