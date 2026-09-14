import {
  MigrationInterface,
  QueryRunner,
  TableForeignKey,
  TableIndex,
} from 'typeorm';

/** Adds the explicit provider boundary to legacy Estate records. */
export class BindLegacyEstateToProvider1789310000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE tbl_estate ADD COLUMN fk_provider_id uuid`,
    );
    await queryRunner.query(`
      UPDATE tbl_estate estate
      SET fk_provider_id = provider.id
      FROM tbl_provider_account provider
      WHERE provider.owner_customer_id = estate.fk_customer_id
        AND provider.deleted_at IS NULL
        AND estate.fk_provider_id IS NULL
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        IF EXISTS (SELECT 1 FROM tbl_estate WHERE deleted_at IS NULL AND fk_provider_id IS NULL) THEN
          RAISE EXCEPTION 'Cannot bind legacy Estate rows: unresolved provider owner mapping';
        END IF;
      END $$
    `);
    await queryRunner.createForeignKey(
      'tbl_estate',
      new TableForeignKey({
        name: 'fk_estate_provider_id',
        columnNames: ['fk_provider_id'],
        referencedTableName: 'tbl_provider_account',
        referencedColumnNames: ['id'],
        onDelete: 'RESTRICT',
      }),
    );
    await queryRunner.createIndex(
      'tbl_estate',
      new TableIndex({
        name: 'idx_estate_provider_id',
        columnNames: ['fk_provider_id'],
      }),
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropIndex('tbl_estate', 'idx_estate_provider_id');
    await queryRunner.dropForeignKey('tbl_estate', 'fk_estate_provider_id');
    await queryRunner.query(
      `ALTER TABLE tbl_estate DROP COLUMN fk_provider_id`,
    );
  }
}
