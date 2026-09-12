import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableForeignKey,
  TableIndex,
} from 'typeorm';

export class CreateSellerAccountTable1789000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'tbl_seller_account',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'uuid',
            default: 'gen_random_uuid()',
          },
          {
            name: 'created_at',
            type: 'timestamptz',
            default: 'NOW()',
            isNullable: false,
          },
          {
            name: 'updated_at',
            type: 'timestamptz',
            default: 'NOW()',
            isNullable: false,
          },
          { name: 'deleted_at', type: 'timestamptz', isNullable: true },
          { name: 'created_by', type: 'varchar', isNullable: true },
          { name: 'updated_by', type: 'varchar', isNullable: true },
          { name: 'owner_user_id', type: 'uuid', isNullable: false },
          { name: 'type', type: 'varchar', length: '32', isNullable: false },
          {
            name: 'display_name',
            type: 'varchar',
            length: '255',
            isNullable: false,
          },
          {
            name: 'status',
            type: 'varchar',
            length: '32',
            default: "'ACTIVE'",
            isNullable: false,
          },
          {
            name: 'verification_status',
            type: 'varchar',
            length: '32',
            default: "'UNVERIFIED'",
            isNullable: false,
          },
        ],
        indices: [
          new TableIndex({
            name: 'uq_seller_account_owner_user_id',
            columnNames: ['owner_user_id'],
            isUnique: true,
          }),
          new TableIndex({
            name: 'idx_seller_account_status',
            columnNames: ['status'],
          }),
          new TableIndex({
            name: 'idx_seller_account_type',
            columnNames: ['type'],
          }),
        ],
        foreignKeys: [
          new TableForeignKey({
            name: 'fk_seller_account_owner_user',
            columnNames: ['owner_user_id'],
            referencedTableName: 'tbl_user',
            referencedColumnNames: ['id'],
            onDelete: 'RESTRICT',
          }),
        ],
      }),
      true,
    );

    await queryRunner.query(`
      ALTER TABLE tbl_seller_account
      ADD CONSTRAINT chk_seller_account_type
      CHECK (type IN ('INDIVIDUAL', 'BROKER', 'AGENCY'))
    `);
    await queryRunner.query(`
      ALTER TABLE tbl_seller_account
      ADD CONSTRAINT chk_seller_account_status
      CHECK (status IN ('ACTIVE', 'SUSPENDED'))
    `);
    await queryRunner.query(`
      ALTER TABLE tbl_seller_account
      ADD CONSTRAINT chk_seller_account_verification_status
      CHECK (verification_status IN ('UNVERIFIED', 'PENDING', 'VERIFIED', 'REJECTED'))
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('tbl_seller_account', true, true, true);
  }
}
