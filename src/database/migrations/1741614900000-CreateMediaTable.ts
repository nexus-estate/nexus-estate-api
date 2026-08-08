import { MigrationInterface, QueryRunner, Table } from 'typeorm';

export class CreateMediaTable1741614900000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE media_type_enum AS ENUM ('image', 'video')
    `);

    await queryRunner.createTable(
      new Table({
        name: 'tbl_media',
        columns: [
          // BaseEntity columns
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'uuid',
            default: 'gen_random_uuid()',
          },
          { name: 'created_at', type: 'timestamptz', default: 'NOW()' },
          { name: 'updated_at', type: 'timestamptz', default: 'NOW()' },
          { name: 'deleted_at', type: 'timestamptz', isNullable: true },
          { name: 'created_by', type: 'uuid', isNullable: true },
          { name: 'updated_by', type: 'uuid', isNullable: true },

          // FK
          { name: 'fk_estate_id', type: 'uuid' },

          // Media fields
          { name: 'media_url', type: 'varchar', length: '1000' },
          { name: 'type', type: 'media_type_enum' },
          { name: 'caption', type: 'varchar', length: '255', isNullable: true },
          { name: 'sort_order', type: 'int', default: 0 },
        ],
        foreignKeys: [
          {
            columnNames: ['fk_estate_id'],
            referencedTableName: 'tbl_estate',
            referencedColumnNames: ['id'],
            onDelete: 'CASCADE',
          },
        ],
      }),
    );

    // Index for fast media query by estate
    await queryRunner.query(`
      CREATE INDEX idx_media_estate ON tbl_media (fk_estate_id) WHERE deleted_at IS NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('tbl_media');
    await queryRunner.query('DROP TYPE media_type_enum');
  }
}
