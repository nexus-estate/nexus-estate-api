import { MigrationInterface, QueryRunner, TableForeignKey } from 'typeorm';

export class AddUserRoleForeignKey1786523569745 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createForeignKey(
      'tbl_user',
      new TableForeignKey({
        name: 'fk_user_role',
        columnNames: ['role_id'],
        referencedTableName: 'tbl_role',
        referencedColumnNames: ['id'],
        onDelete: 'RESTRICT',
      }),
    );
  }
  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropForeignKey('tbl_user', 'fk_user_role');
  }
}
