import { MigrationInterface, Table } from 'typeorm';
import type { QueryRunner } from 'typeorm';

export class CreateListingPromotionTable1790225415439 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'tbl_listing_promotion',
        columns: [
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
          { name: 'created_by', type: 'varchar', isNullable: true },
          { name: 'updated_by', type: 'varchar', isNullable: true },
          { name: 'fk_listing_id', type: 'uuid' },
          {
            name: 'promotion_type',
            type: 'enum',
            enumName: 'tbl_listing_promotion_promotion_type_enum',
            enum: ['BANNER'],
          },
          { name: 'start_at', type: 'timestamptz' },
          { name: 'end_at', type: 'timestamptz' },
        ],
        foreignKeys: [
          {
            name: 'fk_listing_promotion_listing',
            columnNames: ['fk_listing_id'],
            referencedTableName: 'tbl_listing',
            referencedColumnNames: ['id'],
            onDelete: 'RESTRICT',
          },
        ],
        checks: [
          {
            name: 'chk_listing_promotion_valid_period',
            expression: '"end_at" > "start_at"',
          },
        ],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('tbl_listing_promotion');
  }
}
