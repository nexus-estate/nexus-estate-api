import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableForeignKey,
  TableIndex,
} from 'typeorm';

/**
 * DataPool has no runtime entity or application usage. This migration removes
 * the abandoned table from databases that already applied its creation.
 * Existing rows are intentionally discarded by this schema cleanup.
 */
export class DropDataPoolTable1789205965991 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('tbl_data_pool', true, true, true);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'tbl_data_pool',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'uuid',
            default: 'gen_random_uuid()',
          },
          { name: 'user_id', type: 'uuid', isNullable: false },
          { name: 'key', type: 'varchar', isNullable: false },
          { name: 'value', type: 'jsonb', isNullable: true },
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
          new TableIndex({ columnNames: ['user_id', 'key'], isUnique: true }),
        ],
      }),
      true,
    );

    await queryRunner.createForeignKey(
      'tbl_data_pool',
      new TableForeignKey({
        columnNames: ['user_id'],
        referencedColumnNames: ['id'],
        referencedTableName: 'tbl_user',
        onDelete: 'CASCADE',
      }),
    );
  }
}
