import { MigrationInterface, QueryRunner, TableForeignKey } from 'typeorm';

export class AddUserRoleForeignKey1789307935985 implements MigrationInterface {
  /** Applies this module-owned schema change to the database. */
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createForeignKey(
      'tbl_customer_account',
      new TableForeignKey({
        name: 'fk_customer_account_role',
        columnNames: ['role_id'],
        referencedTableName: 'tbl_role',
        referencedColumnNames: ['id'],
        onDelete: 'RESTRICT',
      }),
    );
  }
  /** Reverses this module-owned schema change for controlled rollback. */
  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropForeignKey(
      'tbl_customer_account',
      'fk_customer_account_role',
    );
  }
}
