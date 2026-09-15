import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class RemoveCustomerUsername1789307935986 implements MigrationInterface {
  /** Preserve the deployed TypeORM migration identity from the legacy User model. */
  readonly name = 'RemoveUsernameFromUser1789307935986';

  /** Applies this module-owned schema change to the database. */
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('tbl_customer_account', 'username');
  }
  /** Reverses this module-owned schema change for controlled rollback. */
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
