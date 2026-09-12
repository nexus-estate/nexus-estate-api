import {
  MigrationInterface,
  QueryRunner,
  TableColumn,
  TableForeignKey,
  TableIndex,
} from 'typeorm';

export class AddLocationHierarchy1786023200000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumns('tbl_province', [
      new TableColumn({
        name: 'code',
        type: 'varchar',
        length: '2',
        isNullable: false,
      }),
      new TableColumn({
        name: 'type',
        type: 'varchar',
        length: '20',
        isNullable: false,
      }),
    ]);

    await queryRunner.createIndex(
      'tbl_province',
      new TableIndex({
        name: 'uq_province_code',
        columnNames: ['code'],
        isUnique: true,
      }),
    );

    await queryRunner.addColumns('tbl_ward', [
      new TableColumn({
        name: 'code',
        type: 'varchar',
        length: '5',
        isNullable: false,
      }),
      new TableColumn({
        name: 'type',
        type: 'varchar',
        length: '20',
        isNullable: false,
      }),
      new TableColumn({
        name: 'fk_province_id',
        type: 'uuid',
        isNullable: false,
      }),
    ]);

    await queryRunner.createIndex(
      'tbl_ward',
      new TableIndex({
        name: 'uq_ward_code',
        columnNames: ['code'],
        isUnique: true,
      }),
    );

    await queryRunner.createForeignKey(
      'tbl_ward',
      new TableForeignKey({
        name: 'fk_ward_province_id',
        columnNames: ['fk_province_id'],
        referencedTableName: 'tbl_province',
        referencedColumnNames: ['id'],
        onDelete: 'RESTRICT',
      }),
    );

    await queryRunner.createIndex(
      'tbl_ward',
      new TableIndex({
        name: 'idx_ward_province',
        columnNames: ['fk_province_id'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropIndex('tbl_ward', 'idx_ward_province');
    await queryRunner.dropForeignKey('tbl_ward', 'fk_ward_province_id');
    await queryRunner.dropIndex('tbl_ward', 'uq_ward_code');
    await queryRunner.dropColumn('tbl_ward', 'fk_province_id');
    await queryRunner.dropColumn('tbl_ward', 'type');
    await queryRunner.dropColumn('tbl_ward', 'code');

    await queryRunner.dropIndex('tbl_province', 'uq_province_code');
    await queryRunner.dropColumn('tbl_province', 'type');
    await queryRunner.dropColumn('tbl_province', 'code');
  }
}
