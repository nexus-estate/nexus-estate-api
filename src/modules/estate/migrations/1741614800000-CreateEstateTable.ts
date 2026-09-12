import { MigrationInterface, QueryRunner, Table } from 'typeorm';

export class CreateEstateTable1741614800000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Enums
    await queryRunner.query(
      `CREATE TYPE estate_type_enum AS ENUM ('APARTMENT', 'HOUSE', 'VILLA', 'TOWNHOUSE', 'LAND', 'OFFICE', 'SHOPHOUSE', 'WAREHOUSE', 'COMMERCIAL', 'HOTEL', 'RESORT', 'FARM', 'OTHER')`,
    );
    await queryRunner.query(
      `CREATE TYPE estate_purpose_enum AS ENUM ('SALE', 'RENT', 'SALE_OR_RENT')`,
    );
    await queryRunner.query(
      `CREATE TYPE estate_status_enum AS ENUM ('pending', 'approved', 'rejected')`,
    );

    // 2. tbl_estate (province/ward FKs are added in CreateAddressTable migration)
    await queryRunner.createTable(
      new Table({
        name: 'tbl_estate',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'uuid',
            default: 'gen_random_uuid()',
          },
          { name: 'created_at', type: 'timestamptz', default: 'NOW()' },
          { name: 'updated_at', type: 'timestamptz', default: 'NOW()' },
          { name: 'deleted_at', type: 'timestamptz', isNullable: true },
          { name: 'created_by', type: 'uuid', isNullable: true },
          { name: 'updated_by', type: 'uuid', isNullable: true },
          { name: 'status', type: 'estate_status_enum', default: "'pending'" },
          { name: 'approved_by', type: 'uuid', isNullable: true },
          { name: 'approved_date', type: 'timestamptz', isNullable: true },
          { name: 'rejected_by', type: 'uuid', isNullable: true },
          { name: 'rejected_date', type: 'timestamptz', isNullable: true },
          { name: 'rejection_reason', type: 'text', isNullable: true },
          { name: 'fk_customer_id', type: 'uuid' },
          { name: 'address', type: 'varchar', length: '500' },
          { name: 'title', type: 'varchar', length: '500' },
          { name: 'price', type: 'bigint', isNullable: true },
          { name: 'type', type: 'estate_type_enum' },
          { name: 'purpose', type: 'estate_purpose_enum' },
          { name: 'description', type: 'text', isNullable: true },
          {
            name: 'area',
            type: 'decimal',
            precision: 10,
            scale: 2,
            isNullable: true,
          },
          { name: 'bedrooms', type: 'int', isNullable: true },
          { name: 'bathrooms', type: 'int', isNullable: true },
          { name: 'floors', type: 'int', isNullable: true },
          {
            name: 'latitude',
            type: 'decimal',
            precision: 10,
            scale: 7,
            isNullable: true,
          },
          {
            name: 'longitude',
            type: 'decimal',
            precision: 10,
            scale: 7,
            isNullable: true,
          },
          { name: 'features', type: 'json', isNullable: true },
          { name: 'start_date', type: 'timestamptz', isNullable: true },
          { name: 'end_date', type: 'timestamptz', isNullable: true },
          { name: 'is_featured', type: 'boolean', default: false },
        ],
        foreignKeys: [
          {
            name: 'fk_estate_customer_id',
            columnNames: ['fk_customer_id'],
            referencedTableName: 'tbl_customer_account',
            referencedColumnNames: ['id'],
            onDelete: 'CASCADE',
          },
        ],
      }),
    );

    // 3. Indexes
    await queryRunner.query(
      `CREATE INDEX idx_estate_status ON tbl_estate (status) WHERE deleted_at IS NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX idx_estate_type ON tbl_estate (type) WHERE deleted_at IS NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX idx_estate_purpose ON tbl_estate (purpose) WHERE deleted_at IS NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('tbl_estate');
    await queryRunner.query('DROP TYPE estate_status_enum');
    await queryRunner.query('DROP TYPE estate_purpose_enum');
    await queryRunner.query('DROP TYPE estate_type_enum');
  }
}
