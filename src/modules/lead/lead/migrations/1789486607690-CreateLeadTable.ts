import { MigrationInterface, QueryRunner, Table } from 'typeorm';

export class CreateLeadTable1789486607690 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE lead_status_enum AS ENUM ('NEW', 'CONTACTED', 'CLOSED')`,
    );
    await queryRunner.createTable(
      new Table({
        name: 'tbl_lead',
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
          { name: 'fk_listing_id', type: 'uuid' },
          { name: 'status', type: 'lead_status_enum', default: "'NEW'" },
          { name: 'name', type: 'varchar', length: '120' },
          { name: 'phone', type: 'varchar', length: '40' },
          { name: 'email', type: 'varchar', length: '254', isNullable: true },
          { name: 'message', type: 'text', isNullable: true },
        ],
        foreignKeys: [
          {
            name: 'fk_lead_listing',
            columnNames: ['fk_listing_id'],
            referencedTableName: 'tbl_listing',
            referencedColumnNames: ['id'],
            onDelete: 'CASCADE',
          },
        ],
      }),
    );
    await queryRunner.query(
      `CREATE INDEX idx_lead_listing_created_at ON tbl_lead (fk_listing_id, created_at DESC) WHERE deleted_at IS NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('tbl_lead');
    await queryRunner.query('DROP TYPE lead_status_enum');
  }
}
