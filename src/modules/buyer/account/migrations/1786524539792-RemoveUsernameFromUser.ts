import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class RemoveUsernameFromUser1786524539792 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('tbl_user', 'username');
  }
  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      'tbl_user',
      new TableColumn({
        name: 'username',
        type: 'varchar',
        isNullable: true,
        isUnique: true,
      }),
    );
  }
}
