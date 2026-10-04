import type { MigrationInterface, QueryRunner } from 'typeorm';

/** Creates append-only storage for events committed with source mutations. */
export class CreateOutboxEventTable1791023416144 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE tbl_outbox_event (
        event_id uuid PRIMARY KEY,
        event_type varchar(160) NOT NULL,
        aggregate_type varchar(64) NOT NULL,
        aggregate_id uuid NOT NULL,
        revision bigint NOT NULL,
        occurred_at timestamptz NOT NULL,
        trace_id varchar(128) NULL,
        payload jsonb NOT NULL,
        created_at timestamptz NOT NULL DEFAULT NOW(),
        CONSTRAINT chk_outbox_event_revision_positive CHECK (revision >= 1),
        CONSTRAINT uq_outbox_event_stream_revision_type
          UNIQUE (aggregate_type, aggregate_id, revision, event_type)
      )
    `);
    await queryRunner.query(`
      CREATE INDEX idx_outbox_event_created_at
      ON tbl_outbox_event (created_at, event_id)
    `);
    await queryRunner.query(`
      CREATE INDEX idx_outbox_event_aggregate_revision
      ON tbl_outbox_event (aggregate_type, aggregate_id, revision)
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE tbl_outbox_event');
  }
}
