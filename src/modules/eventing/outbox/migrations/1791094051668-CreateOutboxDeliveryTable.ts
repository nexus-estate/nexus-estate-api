import type { MigrationInterface, QueryRunner } from 'typeorm';

/** Adds mutable delivery state while preserving immutable event rows. */
export class CreateOutboxDeliveryTable1791094051668 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE tbl_outbox_delivery (
        event_id uuid PRIMARY KEY
          REFERENCES tbl_outbox_event(event_id) ON DELETE RESTRICT,
        attempt_count integer NOT NULL DEFAULT 0,
        next_attempt_at timestamptz NOT NULL DEFAULT NOW(),
        lease_owner varchar(128) NULL,
        leased_until timestamptz NULL,
        delivered_at timestamptz NULL,
        last_error_code varchar(128) NULL,
        last_error_message text NULL,
        created_at timestamptz NOT NULL DEFAULT NOW(),
        updated_at timestamptz NOT NULL DEFAULT NOW(),
        CONSTRAINT chk_outbox_delivery_attempt_count
          CHECK (attempt_count >= 0),
        CONSTRAINT chk_outbox_delivery_lease_pair
          CHECK (
            (lease_owner IS NULL AND leased_until IS NULL)
            OR (lease_owner IS NOT NULL AND leased_until IS NOT NULL)
          )
      )
    `);

    await queryRunner.query(`
      CREATE INDEX idx_outbox_delivery_pending
      ON tbl_outbox_delivery (next_attempt_at, leased_until, event_id)
      WHERE delivered_at IS NULL
    `);

    // Install the compatibility trigger before backfill. CREATE TRIGGER takes
    // a conflicting table lock, so old writers either appear in the backfill
    // or run after the trigger becomes active.
    await queryRunner.query(`
      CREATE FUNCTION public.create_outbox_delivery_state()
      RETURNS trigger
      LANGUAGE plpgsql
      SECURITY DEFINER
      SET search_path = pg_catalog, public
      AS $outbox_delivery$
      BEGIN
        INSERT INTO public.tbl_outbox_delivery (event_id)
        VALUES (NEW.event_id);
        RETURN NEW;
      END;
      $outbox_delivery$
    `);
    await queryRunner.query(`
      CREATE TRIGGER trg_outbox_event_delivery_created
      AFTER INSERT ON tbl_outbox_event
      FOR EACH ROW
      EXECUTE FUNCTION public.create_outbox_delivery_state()
    `);

    await queryRunner.query(`
      INSERT INTO tbl_outbox_delivery (event_id)
      SELECT event_id
      FROM tbl_outbox_event
      ON CONFLICT (event_id) DO NOTHING
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP TRIGGER trg_outbox_event_delivery_created ON tbl_outbox_event
    `);
    await queryRunner.query(
      'DROP FUNCTION public.create_outbox_delivery_state()',
    );
    await queryRunner.query('DROP TABLE tbl_outbox_delivery');
  }
}
