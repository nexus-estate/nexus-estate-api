import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import type { ClaimedOutboxEvent } from '../types/claimed-outbox-event';

interface ClaimedOutboxRow {
  event_id: string;
  event_type: string;
  aggregate_type: string;
  aggregate_id: string;
  revision: string;
  occurred_at: Date | string;
  trace_id: string | null;
  payload: unknown;
  attempt_count: number;
  lease_expired: boolean;
}

export interface OutboxBacklogStats {
  pendingTotal: string;
  oldestPendingAgeSeconds: number;
}

const CLAIM_PENDING_EVENTS_SQL = `
  WITH candidates AS (
    SELECT
      d.event_id,
      (d.leased_until IS NOT NULL AND d.leased_until <= NOW()) AS lease_expired
    FROM tbl_outbox_delivery d
    JOIN tbl_outbox_event e ON e.event_id = d.event_id
    WHERE d.delivered_at IS NULL
      AND d.next_attempt_at <= NOW()
      AND (d.leased_until IS NULL OR d.leased_until <= NOW())
      AND NOT EXISTS (
        SELECT 1
        FROM tbl_outbox_delivery older_d
        JOIN tbl_outbox_event older_e ON older_e.event_id = older_d.event_id
        WHERE older_e.aggregate_type = e.aggregate_type
          AND older_e.aggregate_id = e.aggregate_id
          AND (
            older_e.revision < e.revision
            OR (
              older_e.revision = e.revision
              AND (older_e.created_at, older_e.event_id) <
                  (e.created_at, e.event_id)
            )
          )
          AND older_d.delivered_at IS NULL
      )
    ORDER BY e.created_at, e.event_id
    LIMIT $1
    FOR UPDATE OF d SKIP LOCKED
  ), claimed AS (
    UPDATE tbl_outbox_delivery d
    SET attempt_count = d.attempt_count + 1,
        lease_owner = $2,
        leased_until = NOW() + ($3 * INTERVAL '1 millisecond'),
        updated_at = NOW()
    FROM candidates c
    WHERE d.event_id = c.event_id
    RETURNING d.event_id, d.attempt_count, c.lease_expired
  )
  SELECT e.event_id,
         e.event_type,
         e.aggregate_type,
         e.aggregate_id,
         e.revision::text AS revision,
         e.occurred_at,
         e.trace_id,
         e.payload,
         c.attempt_count,
         c.lease_expired
  FROM claimed c
  JOIN tbl_outbox_event e ON e.event_id = c.event_id
  ORDER BY e.created_at, e.event_id
`;

/** Claims delivery rows atomically and fences mutable updates by lease owner. */
@Injectable()
export class OutboxDeliveryRepo {
  constructor(private readonly dataSource: DataSource) {}

  async claimBatch(
    leaseOwner: string,
    batchSize: number,
    leaseMs: number,
  ): Promise<ClaimedOutboxEvent[]> {
    const rows: unknown = await this.dataSource.transaction((manager) =>
      manager.query(CLAIM_PENDING_EVENTS_SQL, [batchSize, leaseOwner, leaseMs]),
    );

    return parseClaimedRows(rows).map((row) => ({
      envelope: {
        eventId: row.event_id,
        eventType: row.event_type,
        aggregateType: row.aggregate_type,
        aggregateId: row.aggregate_id,
        revision: row.revision,
        occurredAt: new Date(row.occurred_at).toISOString(),
        traceId: row.trace_id,
        payload: row.payload,
      },
      attemptCount: row.attempt_count,
      leaseExpired: row.lease_expired,
    }));
  }

  async markDelivered(eventId: string, leaseOwner: string): Promise<boolean> {
    const rows: unknown = await this.dataSource.query(
      `
        UPDATE tbl_outbox_delivery
        SET delivered_at = NOW(),
            lease_owner = NULL,
            leased_until = NULL,
            last_error_code = NULL,
            last_error_message = NULL,
            updated_at = NOW()
        WHERE event_id = $1
          AND lease_owner = $2
          AND delivered_at IS NULL
        RETURNING event_id
      `,
      [eventId, leaseOwner],
    );
    return parseReturnedEventIds(rows).length === 1;
  }

  async scheduleRetry(
    eventId: string,
    leaseOwner: string,
    delayMs: number,
    errorCode: string,
    errorMessage: string,
  ): Promise<boolean> {
    const rows: unknown = await this.dataSource.query(
      `
        UPDATE tbl_outbox_delivery
        SET next_attempt_at = NOW() + ($3 * INTERVAL '1 millisecond'),
            lease_owner = NULL,
            leased_until = NULL,
            last_error_code = $4,
            last_error_message = $5,
            updated_at = NOW()
        WHERE event_id = $1
          AND lease_owner = $2
          AND delivered_at IS NULL
        RETURNING event_id
      `,
      [eventId, leaseOwner, delayMs, errorCode, errorMessage],
    );
    return parseReturnedEventIds(rows).length === 1;
  }

  async getBacklogStats(): Promise<OutboxBacklogStats> {
    const query = `
      SELECT COUNT(*)::text AS pending_total,
             COALESCE(
               EXTRACT(EPOCH FROM NOW() - MIN(e.created_at)),
               0
             )::float8 AS oldest_pending_age_seconds
      FROM tbl_outbox_delivery d
      JOIN tbl_outbox_event e ON e.event_id = d.event_id
      WHERE d.delivered_at IS NULL
    `;
    const rows: unknown = await this.dataSource.query(query);
    if (!Array.isArray(rows) || rows.length !== 1 || !isRecord(rows[0])) {
      throw new Error('Outbox backlog query returned an invalid result');
    }
    const row = rows[0];
    if (
      typeof row.pending_total !== 'string' ||
      typeof row.oldest_pending_age_seconds !== 'number'
    ) {
      throw new Error('Outbox backlog query returned invalid metric values');
    }
    return {
      pendingTotal: row.pending_total,
      oldestPendingAgeSeconds: row.oldest_pending_age_seconds,
    };
  }
}

function parseClaimedRows(result: unknown): ClaimedOutboxRow[] {
  if (!Array.isArray(result)) {
    throw new Error('Outbox claim query returned an invalid result');
  }
  return result.map((value) => {
    if (!isRecord(value)) {
      throw new Error('Outbox claim query returned an invalid row');
    }
    const occurredAt = value.occurred_at;
    if (!(occurredAt instanceof Date) && typeof occurredAt !== 'string') {
      throw new Error('Outbox claim query returned an invalid occurred_at');
    }
    if (
      typeof value.attempt_count !== 'number' ||
      typeof value.lease_expired !== 'boolean'
    ) {
      throw new Error('Outbox claim query returned invalid delivery metadata');
    }
    return {
      event_id: stringValue(value.event_id, 'event_id'),
      event_type: stringValue(value.event_type, 'event_type'),
      aggregate_type: stringValue(value.aggregate_type, 'aggregate_type'),
      aggregate_id: stringValue(value.aggregate_id, 'aggregate_id'),
      revision: stringValue(value.revision, 'revision'),
      occurred_at: occurredAt,
      trace_id:
        value.trace_id === null
          ? null
          : stringValue(value.trace_id, 'trace_id'),
      payload: value.payload,
      attempt_count: value.attempt_count,
      lease_expired: value.lease_expired,
    };
  });
}

function parseReturnedEventIds(result: unknown): string[] {
  if (!Array.isArray(result)) {
    throw new Error('Outbox delivery update returned an invalid result');
  }
  // TypeORM's PostgreSQL driver returns UPDATE/DELETE raw results as
  // [rows, rowCount], while query mocks and other drivers may return rows.
  const rows =
    result.length === 2 &&
    Array.isArray(result[0]) &&
    typeof result[1] === 'number'
      ? result[0]
      : result;
  return rows.map((value) => {
    if (!isRecord(value)) {
      throw new Error('Outbox delivery update returned an invalid row');
    }
    return stringValue(value.event_id, 'event_id');
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function stringValue(value: unknown, field: string): string {
  if (typeof value !== 'string') {
    throw new Error(`Outbox query returned an invalid ${field}`);
  }
  return value;
}
