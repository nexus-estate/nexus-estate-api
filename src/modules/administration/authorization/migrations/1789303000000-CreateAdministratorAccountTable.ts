import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableForeignKey,
  TableIndex,
} from 'typeorm';

/** Creates the credential store for the internal administration portal. */
export class CreateAdministratorAccountTable1789303000000 implements MigrationInterface {
  /** Creates administrator credentials without coupling them to customer data. */
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'tbl_administrator_account',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'uuid',
            default: 'gen_random_uuid()',
          },
          { name: 'email', type: 'varchar', isNullable: false },
          { name: 'password', type: 'varchar', isNullable: false },
          { name: 'role_id', type: 'uuid', isNullable: false },
          {
            name: 'is_active',
            type: 'boolean',
            default: true,
            isNullable: false,
          },
          { name: 'last_login', type: 'timestamp', isNullable: true },
          {
            name: 'created_at',
            type: 'timestamp',
            default: 'now()',
            isNullable: false,
          },
          {
            name: 'updated_at',
            type: 'timestamp',
            default: 'now()',
            isNullable: false,
          },
          { name: 'deleted_at', type: 'timestamp', isNullable: true },
          { name: 'created_by', type: 'varchar', isNullable: true },
          { name: 'updated_by', type: 'varchar', isNullable: true },
        ],
        indices: [
          new TableIndex({
            name: 'uq_administrator_account_email',
            columnNames: ['email'],
            isUnique: true,
          }),
          new TableIndex({
            name: 'idx_administrator_account_role_id',
            columnNames: ['role_id'],
          }),
        ],
        foreignKeys: [
          new TableForeignKey({
            name: 'fk_administrator_account_role',
            columnNames: ['role_id'],
            referencedTableName: 'tbl_role',
            referencedColumnNames: ['id'],
            onDelete: 'RESTRICT',
          }),
        ],
      }),
      true,
    );
  }

  /** Removes only the administration credential table. */
  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('tbl_administrator_account', true, true, true);
  }
}
