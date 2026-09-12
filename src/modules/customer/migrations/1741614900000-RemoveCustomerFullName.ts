import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class RemoveCustomerFullName1741614900000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('tbl_customer_account', 'full_name');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      'tbl_customer_account',
      new TableColumn({
        name: 'full_name',
        type: 'varchar',
        length: '100',
        isNullable: true,
      }),
    );
  }
}
