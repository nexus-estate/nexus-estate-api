import {
  MigrationInterface,
  Table,
  TableColumn,
  TableForeignKey,
} from 'typeorm';
import type { QueryRunner } from 'typeorm';

export class CreatePromotionAndAlignListingPromotion1790513881772 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'tbl_promotion',
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
          {
            name: 'type',
            type: 'enum',
            enumName: 'tbl_promotion_type_enum',
            enum: ['BANNER', 'TOP_SEARCH', 'FEATURED'],
          },
          { name: 'name', type: 'varchar' },
          {
            name: 'value_type',
            type: 'enum',
            enumName: 'tbl_promotion_value_type_enum',
            enum: ['MONEY', 'TEXT'],
          },
          { name: 'money_value', type: 'numeric', isNullable: true },
          { name: 'text_value', type: 'text', isNullable: true },
          {
            name: 'image_urls',
            type: 'text',
            isArray: true,
            isNullable: true,
          },
          { name: 'is_active', type: 'boolean', default: true },
        ],
      }),
    );

    await queryRunner.query(
      'ALTER TABLE tbl_listing_promotion DROP COLUMN promotion_type',
    );
    await queryRunner.query(
      'DROP TYPE IF EXISTS tbl_listing_promotion_promotion_type_enum',
    );

    await queryRunner.addColumn(
      'tbl_listing_promotion',
      new TableColumn({
        name: 'fk_promotion_id',
        type: 'uuid',
        isNullable: false,
      }),
    );
    await queryRunner.addColumn(
      'tbl_listing_promotion',
      new TableColumn({
        name: 'price_snapshot',
        type: 'numeric',
        isNullable: false,
      }),
    );

    await queryRunner.createForeignKey(
      'tbl_listing_promotion',
      new TableForeignKey({
        name: 'fk_listing_promotion_promotion',
        columnNames: ['fk_promotion_id'],
        referencedTableName: 'tbl_promotion',
        referencedColumnNames: ['id'],
        onDelete: 'RESTRICT',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropForeignKey(
      'tbl_listing_promotion',
      'fk_listing_promotion_promotion',
    );
    await queryRunner.dropColumn('tbl_listing_promotion', 'price_snapshot');
    await queryRunner.dropColumn('tbl_listing_promotion', 'fk_promotion_id');

    await queryRunner.query(
      `CREATE TYPE tbl_listing_promotion_promotion_type_enum AS ENUM ('BANNER')`,
    );
    await queryRunner.query(
      'ALTER TABLE tbl_listing_promotion ADD COLUMN promotion_type tbl_listing_promotion_promotion_type_enum NOT NULL',
    );

    await queryRunner.dropTable('tbl_promotion');
    await queryRunner.query(
      'DROP TYPE IF EXISTS tbl_promotion_value_type_enum',
    );
    await queryRunner.query('DROP TYPE IF EXISTS tbl_promotion_type_enum');
  }
}
