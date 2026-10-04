# Outbox Runtime Operations

## Deployment contract

Use the same immutable image tag as the HTTP API:

```text
image:   ghcr.io/nexus-estate/nexus-api:<sha>
command: node dist/outbox.main.js
ingress: none
```

Provide the Nexus Estate PostgreSQL configuration and Kafka producer settings
from runtime configuration and Secrets. Grant producer access only to
`nexus.marketplace.listing.v1`; the runtime does not need consumer ACLs. Keep
credentials out of Git and ConfigMaps. Run the delivery schema migration
before starting the new runtime. The migration installs a trigger before
backfill to cover older API replicas that still insert events.

The default internal probe/metrics port is `9091`. Scrape `/metrics`, use
`/health/live` for process liveness, and use `/health/ready` for database,
Kafka, and dispatcher readiness. Kafka outage should make readiness false;
it must not cause liveness restart loops. Set termination grace above
`OUTBOX_DRAIN_TIMEOUT_MS` (default 35 seconds).

## Configuration

Required by the outbox process:

```text
DB_POSTGRES_HOST / DB_POSTGRES_PORT / DB_POSTGRES_USER
DB_POSTGRES_PASS / DB_POSTGRES_NAME
KAFKA_BROKERS
KAFKA_CLIENT_ID
KAFKA_TOPIC_MARKETPLACE_LISTING=nexus.marketplace.listing.v1
```

For SASL, set `KAFKA_SECURITY_PROTOCOL` to `sasl_ssl` or `sasl_plaintext`, set
`KAFKA_SASL_MECHANISM`, and inject `KAFKA_SASL_USERNAME` and
`KAFKA_SASL_PASSWORD` through a runtime Secret. The HTTP API does not require
these Kafka values.

Defaults are `OUTBOX_BATCH_SIZE=25`, `OUTBOX_POLL_INTERVAL_MS=1000`,
`OUTBOX_LEASE_MS=60000`, `OUTBOX_RETRY_BASE_MS=1000`,
`OUTBOX_RETRY_MAX_MS=300000`, `OUTBOX_PUBLISH_TIMEOUT_MS=30000`,
`OUTBOX_DRAIN_TIMEOUT_MS=35000`, and `OUTBOX_HEALTH_PORT=9091`. The lease must
be longer than the publish timeout. Batch size also bounds concurrent Kafka
sends.

## Read-only backlog diagnostics

Pending count and oldest age are available from `/metrics`. Inspect the
oldest undelivered rows and their last failure with:

```sql
SELECT e.event_id,
       e.event_type,
       e.aggregate_type,
       e.aggregate_id,
       e.revision::text,
       e.created_at,
       d.attempt_count,
       d.next_attempt_at,
       d.lease_owner,
       d.leased_until,
       d.last_error_code,
       d.last_error_message
FROM tbl_outbox_delivery d
JOIN tbl_outbox_event e ON e.event_id = d.event_id
WHERE d.delivered_at IS NULL
ORDER BY e.created_at, e.event_id
LIMIT 100;
```

Find aggregate heads that block later revisions with:

```sql
SELECT e.aggregate_type,
       e.aggregate_id,
       e.revision::text,
       e.event_id,
       d.attempt_count,
       d.next_attempt_at,
       d.lease_owner,
       d.leased_until,
       d.last_error_code
FROM tbl_outbox_event e
JOIN tbl_outbox_delivery d ON d.event_id = e.event_id
WHERE d.delivered_at IS NULL
  AND NOT EXISTS (
    SELECT 1
    FROM tbl_outbox_event older_e
    JOIN tbl_outbox_delivery older_d ON older_d.event_id = older_e.event_id
    WHERE older_e.aggregate_type = e.aggregate_type
      AND older_e.aggregate_id = e.aggregate_id
      AND (older_e.revision, older_e.created_at, older_e.event_id)
          < (e.revision, e.created_at, e.event_id)
      AND older_d.delivered_at IS NULL
  )
ORDER BY e.created_at, e.event_id;
```

These queries are diagnostic only. Do not edit immutable event rows or mark an
event delivered to clear a backlog. There is no quarantine or manual skip
workflow in this release.

## Failure recovery

When Kafka is unavailable, keep the runtime deployed. It retains liveness,
leaves unclaimed rows in PostgreSQL, and reconnects on the polling interval.
After Kafka recovers, it claims and drains due rows. Retry timestamps are
durable; later events for a Listing remain blocked by an earlier pending
revision.

If a process stops while holding a lease, another instance can claim that row
after `leased_until`. If a record appears in Kafka but the database still
shows it pending, the publisher may have stopped after Kafka ACK and before
the delivery mark. Allow lease recovery; an identical duplicate is expected.

Alert on sustained growth in `outbox_pending_total` or
`outbox_oldest_pending_age_seconds`, and on repeated
`outbox_publish_failure_total` growth. Check Kafka connectivity, producer ACL,
topic existence, and the oldest row's sanitized error. A poison event is not
skipped automatically because doing so would break per-Listing progression.
