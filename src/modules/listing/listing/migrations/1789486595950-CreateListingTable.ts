import { MigrationInterface, QueryRunner, Table } from 'typeorm';

export class CreateListingTable1789486595950 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE listing_status_enum AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED')`,
    );
    await queryRunner.createTable(
      new Table({
        name: 'tbl_listing',
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
          { name: 'fk_estate_id', type: 'uuid', isUnique: true },
          { name: 'fk_provider_id', type: 'uuid' },
          { name: 'status', type: 'listing_status_enum', default: "'DRAFT'" },
          { name: 'published_at', type: 'timestamptz', isNullable: true },
        ],
        foreignKeys: [
          {
            name: 'fk_listing_estate',
            columnNames: ['fk_estate_id'],
            referencedTableName: 'tbl_estate',
            referencedColumnNames: ['id'],
            onDelete: 'RESTRICT',
          },
          {
            name: 'fk_listing_provider',
            columnNames: ['fk_provider_id'],
            referencedTableName: 'tbl_provider_account',
            referencedColumnNames: ['id'],
            onDelete: 'RESTRICT',
          },
        ],
      }),
    );
    await queryRunner.query(
      `CREATE INDEX idx_listing_status_published_at ON tbl_listing (status, published_at) WHERE deleted_at IS NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('tbl_listing');
    await queryRunner.query('DROP TYPE listing_status_enum');
  }
}
