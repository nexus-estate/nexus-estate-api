import { MigrationInterface, QueryRunner, TableIndex } from 'typeorm';

export class CleanupDuplicateUniqueIndexes1786530000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropIndex(
      'tbl_customer_account',
      'IDX_c54a0a08149c9edd6d0a7fbffc',
    );
    await queryRunner.dropIndex('tbl_role', 'IDX_9202294311d3253394ec1a84c9');
    await queryRunner.dropIndex(
      'tbl_permission',
      'IDX_efa2f8f4b8c180a9f663bf6195',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createIndex(
      'tbl_customer_account',
      new TableIndex({
        name: 'IDX_c54a0a08149c9edd6d0a7fbffc',
        columnNames: ['email'],
        isUnique: true,
      }),
    );
    await queryRunner.createIndex(
      'tbl_role',
      new TableIndex({
        name: 'IDX_9202294311d3253394ec1a84c9',
        columnNames: ['name'],
        isUnique: true,
      }),
    );
    await queryRunner.createIndex(
      'tbl_permission',
      new TableIndex({
        name: 'IDX_efa2f8f4b8c180a9f663bf6195',
        columnNames: ['name'],
        isUnique: true,
      }),
    );
  }
}
