import type { MigrationInterface, QueryRunner } from 'typeorm';

/** Adds a persisted per-listing source revision for Marketplace projections. */
export class AddListingProjectionRevision1791017550218 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE tbl_listing
      ADD COLUMN projection_revision bigint NOT NULL DEFAULT 1
    `);
    await queryRunner.query(`
      ALTER TABLE tbl_listing
      ADD CONSTRAINT chk_listing_projection_revision_positive
      CHECK (projection_revision >= 1)
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE tbl_listing
      DROP CONSTRAINT chk_listing_projection_revision_positive
    `);
    await queryRunner.query(`
      ALTER TABLE tbl_listing
      DROP COLUMN projection_revision
    `);
  }
}
