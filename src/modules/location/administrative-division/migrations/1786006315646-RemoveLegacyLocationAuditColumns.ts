import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

const LOCATION_TABLES = ['tbl_province', 'tbl_ward'] as const;

const LEGACY_COLUMNS = ['deleted_at', 'created_by', 'updated_by'] as const;

export class RemoveLegacyLocationAuditColumns1786006315646 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const tableName of LOCATION_TABLES) {
      for (const columnName of LEGACY_COLUMNS) {
        const exists = await queryRunner.hasColumn(tableName, columnName);

        if (exists) {
          await queryRunner.dropColumn(tableName, columnName);
        }
      }
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const tableName of LOCATION_TABLES) {
      const hasDeletedAt = await queryRunner.hasColumn(tableName, 'deleted_at');

      if (!hasDeletedAt) {
        await queryRunner.addColumn(
          tableName,
          new TableColumn({
            name: 'deleted_at',
            type: 'timestamptz',
            isNullable: true,
          }),
        );
      }

      const hasCreatedBy = await queryRunner.hasColumn(tableName, 'created_by');

      if (!hasCreatedBy) {
        await queryRunner.addColumn(
          tableName,
          new TableColumn({
            name: 'created_by',
            type: 'varchar',
            isNullable: true,
          }),
        );
      }

      const hasUpdatedBy = await queryRunner.hasColumn(tableName, 'updated_by');

      if (!hasUpdatedBy) {
        await queryRunner.addColumn(
          tableName,
          new TableColumn({
            name: 'updated_by',
            type: 'varchar',
            isNullable: true,
          }),
        );
      }
    }
  }
}
