import { MigrationInterface, QueryRunner, TableForeignKey } from 'typeorm';

export class AlignEstateTableWithEntity1788883926000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      DECLARE
        null_price_count bigint;
        null_province_count bigint;
        null_ward_count bigint;
      BEGIN
        SELECT
          COUNT(*) FILTER (WHERE price IS NULL),
          COUNT(*) FILTER (WHERE fk_province_id IS NULL),
          COUNT(*) FILTER (WHERE fk_ward_id IS NULL)
        INTO
          null_price_count,
          null_province_count,
          null_ward_count
        FROM tbl_estate;

        IF null_price_count > 0
          OR null_province_count > 0
          OR null_ward_count > 0
        THEN
          RAISE EXCEPTION
            'Cannot align tbl_estate: NULL values exist (price=%, fk_province_id=%, fk_ward_id=%). Backfill valid data before retrying.',
            null_price_count,
            null_province_count,
            null_ward_count;
        END IF;
      END $$;
    `);

    await this.dropForeignKeyByColumns(queryRunner, ['fk_user_id']);
    await this.dropForeignKeyByColumns(queryRunner, ['fk_province_id']);
    await this.dropForeignKeyByColumns(queryRunner, ['fk_ward_id']);

    await queryRunner.renameColumn('tbl_estate', 'address', 'address_line');

    await queryRunner.query(`
      ALTER TABLE tbl_estate
        ALTER COLUMN price SET NOT NULL,
        ALTER COLUMN fk_province_id SET NOT NULL,
        ALTER COLUMN fk_ward_id SET NOT NULL
    `);

    await queryRunner.query(
      'ALTER TYPE estate_type_enum RENAME TO tbl_estate_type_enum',
    );
    await queryRunner.query(
      'ALTER TYPE estate_purpose_enum RENAME TO tbl_estate_purpose_enum',
    );

    await queryRunner.createForeignKeys('tbl_estate', [
      new TableForeignKey({
        name: 'FK_ea385f80db7ac7785a7c596775d',
        columnNames: ['fk_user_id'],
        referencedTableName: 'tbl_user',
        referencedColumnNames: ['id'],
        onDelete: 'RESTRICT',
      }),
      new TableForeignKey({
        name: 'FK_4cde4efe3e6fe5f784a81dc3e21',
        columnNames: ['fk_province_id'],
        referencedTableName: 'tbl_province',
        referencedColumnNames: ['id'],
        onDelete: 'RESTRICT',
      }),
      new TableForeignKey({
        name: 'FK_3776c4c5e5bd66c875dfc25ca7a',
        columnNames: ['fk_ward_id'],
        referencedTableName: 'tbl_ward',
        referencedColumnNames: ['id'],
        onDelete: 'RESTRICT',
      }),
    ]);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await this.dropForeignKeyByColumns(queryRunner, ['fk_user_id']);
    await this.dropForeignKeyByColumns(queryRunner, ['fk_province_id']);
    await this.dropForeignKeyByColumns(queryRunner, ['fk_ward_id']);

    await queryRunner.query(
      'ALTER TYPE tbl_estate_type_enum RENAME TO estate_type_enum',
    );
    await queryRunner.query(
      'ALTER TYPE tbl_estate_purpose_enum RENAME TO estate_purpose_enum',
    );

    await queryRunner.query(`
      ALTER TABLE tbl_estate
        ALTER COLUMN price DROP NOT NULL,
        ALTER COLUMN fk_province_id DROP NOT NULL,
        ALTER COLUMN fk_ward_id DROP NOT NULL
    `);

    await queryRunner.renameColumn('tbl_estate', 'address_line', 'address');

    await queryRunner.createForeignKeys('tbl_estate', [
      new TableForeignKey({
        name: 'fk_estate_user_id',
        columnNames: ['fk_user_id'],
        referencedTableName: 'tbl_user',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
      new TableForeignKey({
        name: 'fk_estate_province_id',
        columnNames: ['fk_province_id'],
        referencedTableName: 'tbl_province',
        referencedColumnNames: ['id'],
        onDelete: 'SET NULL',
      }),
      new TableForeignKey({
        name: 'fk_estate_ward_id',
        columnNames: ['fk_ward_id'],
        referencedTableName: 'tbl_ward',
        referencedColumnNames: ['id'],
        onDelete: 'SET NULL',
      }),
    ]);
  }

  private async dropForeignKeyByColumns(
    queryRunner: QueryRunner,
    columnNames: string[],
  ): Promise<void> {
    const table = await queryRunner.getTable('tbl_estate');
    const foreignKey = table?.foreignKeys.find(
      (candidate) =>
        candidate.columnNames.length === columnNames.length &&
        candidate.columnNames.every((column) => columnNames.includes(column)),
    );

    if (foreignKey) {
      await queryRunner.dropForeignKey('tbl_estate', foreignKey);
    }
  }
}
