import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Converts the legacy Estate moderation enum to the Property lifecycle.
 *
 * Legacy mapping is explicit and exhaustive:
 * pending -> DRAFT, approved -> ACTIVE, rejected -> ARCHIVED.
 * The status column is temporarily expanded to text so existing rows are
 * backfilled and verified before the lifecycle enum becomes the contract.
 */
export class MigrateEstateStatusToLifecycle1790076216829 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE tbl_estate ALTER COLUMN status DROP DEFAULT`,
    );
    await queryRunner.query(
      `ALTER TABLE tbl_estate ALTER COLUMN status TYPE text USING status::text`,
    );

    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM tbl_estate
          WHERE status IS NULL OR status NOT IN ('pending', 'approved', 'rejected')
        ) THEN
          RAISE EXCEPTION 'Cannot migrate tbl_estate.status: unmapped legacy status exists';
        END IF;
      END $$;
    `);

    await queryRunner.query(`
      UPDATE tbl_estate
      SET status = CASE status
        WHEN 'pending' THEN 'DRAFT'
        WHEN 'approved' THEN 'ACTIVE'
        WHEN 'rejected' THEN 'ARCHIVED'
      END
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM tbl_estate
          WHERE status IS NULL OR status NOT IN ('DRAFT', 'ACTIVE', 'ARCHIVED')
        ) THEN
          RAISE EXCEPTION 'Cannot migrate tbl_estate.status: backfill left unmapped rows';
        END IF;
      END $$;
    `);

    await queryRunner.query(
      `CREATE TYPE estate_lifecycle_status_enum AS ENUM ('DRAFT', 'ACTIVE', 'ARCHIVED')`,
    );
    await queryRunner.query(`
      ALTER TABLE tbl_estate
      ALTER COLUMN status TYPE estate_lifecycle_status_enum
      USING status::estate_lifecycle_status_enum
    `);
    const legacyEnum = (await queryRunner.query(`
      SELECT EXISTS (
        SELECT 1 FROM pg_type WHERE typname = 'estate_status_enum'
      ) AS exists
    `)) as Array<{ exists: boolean }>;
    if (legacyEnum[0]?.exists) {
      await queryRunner.query(
        `ALTER TYPE estate_status_enum RENAME TO estate_status_legacy_enum`,
      );
      await queryRunner.query(
        `ALTER TYPE estate_lifecycle_status_enum RENAME TO estate_status_enum`,
      );
      await queryRunner.query(`DROP TYPE estate_status_legacy_enum`);
    } else {
      await queryRunner.query(
        `ALTER TYPE estate_lifecycle_status_enum RENAME TO estate_status_enum`,
      );
    }
    await queryRunner.query(
      `ALTER TABLE tbl_estate ALTER COLUMN status SET DEFAULT 'DRAFT'`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE tbl_estate ALTER COLUMN status DROP DEFAULT`,
    );
    await queryRunner.query(
      `ALTER TABLE tbl_estate ALTER COLUMN status TYPE text USING status::text`,
    );
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM tbl_estate
          WHERE status IS NULL OR status NOT IN ('DRAFT', 'ACTIVE', 'ARCHIVED')
        ) THEN
          RAISE EXCEPTION 'Cannot roll back tbl_estate.status: unmapped lifecycle status exists';
        END IF;
      END $$;
    `);
    await queryRunner.query(`
      UPDATE tbl_estate
      SET status = CASE status
        WHEN 'DRAFT' THEN 'pending'
        WHEN 'ACTIVE' THEN 'approved'
        WHEN 'ARCHIVED' THEN 'rejected'
      END
    `);
    await queryRunner.query(
      `CREATE TYPE estate_status_legacy_enum AS ENUM ('pending', 'approved', 'rejected')`,
    );
    await queryRunner.query(`
      ALTER TABLE tbl_estate
      ALTER COLUMN status TYPE estate_status_legacy_enum
      USING status::estate_status_legacy_enum
    `);
    await queryRunner.query(
      `ALTER TYPE estate_status_enum RENAME TO estate_lifecycle_status_enum`,
    );
    await queryRunner.query(
      `ALTER TYPE estate_status_legacy_enum RENAME TO estate_status_enum`,
    );
    await queryRunner.query(`DROP TYPE estate_lifecycle_status_enum`);
    await queryRunner.query(
      `ALTER TABLE tbl_estate ALTER COLUMN status SET DEFAULT 'pending'`,
    );
  }
}
