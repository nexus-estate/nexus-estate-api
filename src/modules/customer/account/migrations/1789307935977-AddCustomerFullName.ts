import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddCustomerFullName1789307935977 implements MigrationInterface {
  /** Preserve the deployed TypeORM migration identity from the legacy User model. */
  readonly name = 'AddFullNameToUserTable1789307935977';

  /** Applies this module-owned schema change to the database. */
  public async up(queryRunner: QueryRunner): Promise<void> {
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

  /** Reverses this module-owned schema change for controlled rollback. */
  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('tbl_customer_account', 'full_name');
  }
}
