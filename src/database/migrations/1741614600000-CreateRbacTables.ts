import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableIndex,
  TableForeignKey,
} from 'typeorm';

export class CreateRbacTables1741614600000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Create tbl_role
    await queryRunner.createTable(
      new Table({
        name: 'tbl_role',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'uuid',
            default: 'gen_random_uuid()',
          },
          { name: 'name', type: 'varchar', isUnique: true, isNullable: false },
          { name: 'description', type: 'text', isNullable: true },
          {
            name: 'is_system',
            type: 'boolean',
            default: false,
            isNullable: false,
          },
          {
            name: 'created_at',
            type: 'timestamp',
            default: 'now()',
            isNullable: false,
          },
          {
            name: 'updated_at',
            type: 'timestamp',
            default: 'now()',
            isNullable: false,
          },
          { name: 'deleted_at', type: 'timestamp', isNullable: true },
          { name: 'created_by', type: 'varchar', isNullable: true },
          { name: 'updated_by', type: 'varchar', isNullable: true },
        ],
        indices: [new TableIndex({ columnNames: ['name'], isUnique: true })],
      }),
      true,
    );

    // 2. Create tbl_permission
    await queryRunner.createTable(
      new Table({
        name: 'tbl_permission',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'uuid',
            default: 'gen_random_uuid()',
          },
          { name: 'name', type: 'varchar', isUnique: true, isNullable: false },
          { name: 'description', type: 'text', isNullable: true },
          { name: 'role_id', type: 'uuid', isNullable: false },
          {
            name: 'created_at',
            type: 'timestamp',
            default: 'now()',
            isNullable: false,
          },
          {
            name: 'updated_at',
            type: 'timestamp',
            default: 'now()',
            isNullable: false,
          },
          { name: 'deleted_at', type: 'timestamp', isNullable: true },
          { name: 'created_by', type: 'varchar', isNullable: true },
          { name: 'updated_by', type: 'varchar', isNullable: true },
        ],
        indices: [
          new TableIndex({ columnNames: ['name'], isUnique: true }),
          new TableIndex({ columnNames: ['role_id'] }),
        ],
      }),
      true,
    );

    // 3. Foreign keys
    await queryRunner.createForeignKey(
      'tbl_permission',
      new TableForeignKey({
        columnNames: ['role_id'],
        referencedColumnNames: ['id'],
        referencedTableName: 'tbl_role',
        onDelete: 'CASCADE',
      }),
    );

    // 4. Seed default roles
    await queryRunner.query(`
      INSERT INTO tbl_role (id, name, description, is_system)
      VALUES
        (gen_random_uuid(), 'admin', 'System administrator with full access', true),
        (gen_random_uuid(), 'broker', 'Real estate broker', true),
        (gen_random_uuid(), 'buyer', 'Property buyer/renter', true)
    `);

    // 5. Seed default permissions
    await queryRunner.query(`
      INSERT INTO tbl_permission (id, name, description, role_id)
      SELECT gen_random_uuid(), 'user:manage', 'Manage users', id FROM tbl_role WHERE name = 'admin'
      UNION ALL SELECT gen_random_uuid(), 'user:read', 'Read user info', id FROM tbl_role WHERE name = 'admin'
      UNION ALL SELECT gen_random_uuid(), 'listing:manage', 'Manage listings', id FROM tbl_role WHERE name = 'admin'
      UNION ALL SELECT gen_random_uuid(), 'listing:create', 'Create listings', id FROM tbl_role WHERE name = 'broker'
      UNION ALL SELECT gen_random_uuid(), 'listing:read', 'Read listings', id FROM tbl_role WHERE name = 'broker'
      UNION ALL SELECT gen_random_uuid(), 'listing:update', 'Update listings', id FROM tbl_role WHERE name = 'broker'
      UNION ALL SELECT gen_random_uuid(), 'listing:delete', 'Delete listings', id FROM tbl_role WHERE name = 'broker'
      UNION ALL SELECT gen_random_uuid(), 'property:read', 'Read properties', id FROM tbl_role WHERE name = 'buyer'
      UNION ALL SELECT gen_random_uuid(), 'lead:manage', 'Manage leads', id FROM tbl_role WHERE name = 'buyer'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('tbl_permission');
    await queryRunner.dropTable('tbl_role');
  }
}
