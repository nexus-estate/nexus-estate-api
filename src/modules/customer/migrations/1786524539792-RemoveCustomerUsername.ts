import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class RemoveCustomerUsername1786524539792 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('tbl_customer_account', 'username');
  }
  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      'tbl_customer_account',
      new TableColumn({
        name: 'username',
        type: 'varchar',
        isNullable: true,
        isUnique: true,
      }),
    );
  }
}
