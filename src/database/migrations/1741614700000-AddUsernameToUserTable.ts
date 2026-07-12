import {
  MigrationInterface,
  QueryRunner,
  TableColumn,
  TableIndex,
} from 'typeorm';

export class AddUsernameToUserTable1741614700000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      'tbl_user',
      new TableColumn({
        name: 'username',
        type: 'varchar',
        isUnique: true,
        isNullable: true,
      }),
    );

    await queryRunner.createIndex(
      'tbl_user',
      new TableIndex({
        columnNames: ['username'],
        isUnique: true,
        where: 'username IS NOT NULL',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropIndex(
      'tbl_user',
      new TableIndex({
        columnNames: ['username'],
        isUnique: true,
        where: 'username IS NOT NULL',
      }),
    );
    await queryRunner.dropColumn('tbl_user', 'username');
  }
}
