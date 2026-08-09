import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddFullNameToUserTable1741614800000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      'tbl_user',
      new TableColumn({
        name: 'full_name',
        type: 'varchar',
        length: '100',
        isNullable: true,
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('tbl_user', 'full_name');
  }
}
