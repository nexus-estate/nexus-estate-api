import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableForeignKey,
  TableIndex,
} from 'typeorm';

/** Creates the provider-account table and its persistence-level invariants. */
export class CreateProviderAccount1789202344037 implements MigrationInterface {
  /** Applies the provider-account schema. */
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'tbl_provider_account',
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
            // BaseEntity uses TypeORM's default timestamp without time zone.
            type: 'timestamp',
            default: 'NOW()',
            isNullable: false,
          },
          {
            name: 'updated_at',
            type: 'timestamp',
            default: 'NOW()',
            isNullable: false,
          },
          { name: 'deleted_at', type: 'timestamp', isNullable: true },
          { name: 'created_by', type: 'varchar', isNullable: true },
          { name: 'updated_by', type: 'varchar', isNullable: true },
          { name: 'owner_customer_id', type: 'uuid', isNullable: false },
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
            name: 'uq_provider_account_owner_customer_id',
            columnNames: ['owner_customer_id'],
            isUnique: true,
          }),
          new TableIndex({
            name: 'idx_provider_account_status',
            columnNames: ['status'],
          }),
          new TableIndex({
            name: 'idx_provider_account_type',
            columnNames: ['type'],
          }),
        ],
        foreignKeys: [
          new TableForeignKey({
            name: 'fk_provider_account_owner_customer',
            columnNames: ['owner_customer_id'],
            referencedTableName: 'tbl_customer_account',
            referencedColumnNames: ['id'],
            onDelete: 'RESTRICT',
          }),
        ],
      }),
      true,
    );

    await queryRunner.query(`
      ALTER TABLE tbl_provider_account
      ADD CONSTRAINT chk_provider_account_type
      CHECK (type IN ('INDIVIDUAL', 'BROKER', 'AGENCY'))
    `);
    await queryRunner.query(`
      ALTER TABLE tbl_provider_account
      ADD CONSTRAINT chk_provider_account_status
      CHECK (status IN ('ACTIVE', 'SUSPENDED'))
    `);
    await queryRunner.query(`
      ALTER TABLE tbl_provider_account
      ADD CONSTRAINT chk_provider_account_verification_status
      CHECK (verification_status IN ('UNVERIFIED', 'PENDING', 'VERIFIED', 'REJECTED'))
    `);
  }

  /** Removes the provider-account schema during a controlled rollback. */
  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('tbl_provider_account', true, true, true);
  }
}
