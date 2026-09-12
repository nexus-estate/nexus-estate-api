import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableColumn,
  TableForeignKey,
} from 'typeorm';

export class CreateAddressTable1741615100000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // ── 1. tbl_province ──────────────────────────────────────
    await queryRunner.createTable(
      new Table({
        name: 'tbl_province',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'uuid',
            default: 'gen_random_uuid()',
          },
          { name: 'name', type: 'varchar', length: '100', isNullable: false },
          { name: 'created_at', type: 'timestamptz', default: 'NOW()' },
          { name: 'updated_at', type: 'timestamptz', default: 'NOW()' },
        ],
      }),
      true,
    );

    // ── 2. tbl_ward ───────────────────────────────────────────
    await queryRunner.createTable(
      new Table({
        name: 'tbl_ward',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'uuid',
            default: 'gen_random_uuid()',
          },
          { name: 'name', type: 'varchar', length: '100', isNullable: false },
          { name: 'created_at', type: 'timestamptz', default: 'NOW()' },
          { name: 'updated_at', type: 'timestamptz', default: 'NOW()' },
        ],
      }),
      true,
    );

    // ── 3. Add province/ward FK columns to tbl_estate ─────────
    await queryRunner.addColumn(
      'tbl_estate',
      new TableColumn({
        name: 'fk_province_id',
        type: 'uuid',
        isNullable: true,
      }),
    );
    await queryRunner.addColumn(
      'tbl_estate',
      new TableColumn({ name: 'fk_ward_id', type: 'uuid', isNullable: true }),
    );

    // ── 4. FK constraints ─────────────────────────────────────
    await queryRunner.createForeignKey(
      'tbl_estate',
      new TableForeignKey({
        name: 'fk_estate_province_id',
        columnNames: ['fk_province_id'],
        referencedTableName: 'tbl_province',
        referencedColumnNames: ['id'],
        onDelete: 'SET NULL',
      }),
    );
    await queryRunner.createForeignKey(
      'tbl_estate',
      new TableForeignKey({
        name: 'fk_estate_ward_id',
        columnNames: ['fk_ward_id'],
        referencedTableName: 'tbl_ward',
        referencedColumnNames: ['id'],
        onDelete: 'SET NULL',
      }),
    );

    // ── 5. Index on province for filtering ────────────────────
    await queryRunner.query(
      `CREATE INDEX idx_estate_province ON tbl_estate (fk_province_id) WHERE deleted_at IS NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropForeignKey('tbl_estate', 'fk_estate_ward_id');
    await queryRunner.dropForeignKey('tbl_estate', 'fk_estate_province_id');
    await queryRunner.dropColumn('tbl_estate', 'fk_ward_id');
    await queryRunner.dropColumn('tbl_estate', 'fk_province_id');
    await queryRunner.dropTable('tbl_ward');
    await queryRunner.dropTable('tbl_province');
  }
}
