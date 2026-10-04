# Durable Outbox Delivery Contract

## Guarantee and boundaries

The delivery runtime provides **at-least-once** delivery from PostgreSQL to
Kafka. The HTTP write path ends at PostgreSQL commit:

```text
canonical mutation + Listing revision + immutable event + delivery state
                               │
                             COMMIT
                               │
                         independent shipper
                               │
                              Kafka
```

Kafka is never called inside the source transaction. The API process does not
import the Kafka adapter and starts without Kafka environment variables.

`tbl_outbox_event` owns immutable event data. `tbl_outbox_delivery` owns
mutable attempts, retry timing, lease, acknowledgement, and last-error state.
An `AFTER INSERT` trigger creates the delivery row in the source transaction;
the migration backfills prior event rows after installing the trigger. The
trigger also covers old API replicas that remain during a rolling deployment.

## Event transport

The runtime reads the persisted envelope only. It does not read Listing or
Estate state and does not regenerate an event ID, revision, payload, trace ID,
or occurrence time. Marketplace Listing events route to
`nexus.marketplace.listing.v1` with:

```text
Kafka key   = EventEnvelope.aggregateId (Listing ID)
Kafka value = JSON.stringify(persisted EventEnvelope)
```

There is no second wrapper. Kafka producer acknowledgement uses `acks=all`, a
finite timeout, bounded client retries, and an idempotent producer. Producer
idempotence reduces duplicate records from internal network retries; it does
not remove the outbox's at-least-once crash boundary.

## Claims, leases, and ordering

The dispatcher claims due rows in a short PostgreSQL transaction with
`FOR UPDATE SKIP LOCKED`, assigns an instance ID and expiry, increments the
attempt count, returns the stored envelope, and commits. Broker I/O and the
delivered/retry update happen after that transaction closes.

One aggregate can have only its earliest undelivered row claimed. A pending
earlier revision blocks all later revisions for that Listing. Multiple
Listings can be claimed and published concurrently. Lease owner guards fence
both retry scheduling and delivery marking. If Kafka ACKs after the lease was
lost, the old owner logs the condition and does not write success; a later
owner may publish the event again.

An expired lease is eligible for a new owner. A crash before sending leaves
the event pending. A crash after Kafka ACK but before `delivered_at` can create
a duplicate after lease expiry. Both copies retain the same logical envelope.

## Retry behavior

Every claim increments `attempt_count`, so the count can include a process
that claimed and stopped before sending. A broker failure stores a sanitized,
1,024-character error message, stable error code, and a database-relative
`next_attempt_at`. Backoff is exponential with bounded positive jitter and a
configured maximum. Retries continue indefinitely at the capped interval;
there is no automatic dead-letter, skip, or same-aggregate advancement.

Errors do not include event payloads. Kafka credentials come from runtime
Secrets and are removed from error text before logging or persistence.

## Runtime and configuration

The same production image runs either entrypoint:

```text
HTTP API:       node dist/main.js
Outbox runtime: node dist/outbox.main.js
```

The outbox entrypoint requires PostgreSQL settings plus `KAFKA_BROKERS`,
`KAFKA_CLIENT_ID`, and `KAFKA_TOPIC_MARKETPLACE_LISTING`. SASL deployments set
`KAFKA_SECURITY_PROTOCOL`, `KAFKA_SASL_MECHANISM`, and credentials from a
runtime Secret. Kafka settings are validated only by the outbox process.

`OUTBOX_BATCH_SIZE`, `OUTBOX_POLL_INTERVAL_MS`, `OUTBOX_LEASE_MS`,
`OUTBOX_RETRY_BASE_MS`, `OUTBOX_RETRY_MAX_MS`,
`OUTBOX_PUBLISH_TIMEOUT_MS`, `OUTBOX_DRAIN_TIMEOUT_MS`, and
`OUTBOX_HEALTH_PORT` control polling and operations. The configured lease must
exceed the finite publish timeout. Set Kubernetes termination grace longer
than the drain timeout.

The process listens only for internal probes and metrics:

```text
GET /health/live
GET /health/ready
GET /metrics
```

Kafka outage keeps liveness healthy and readiness false. PostgreSQL and Kafka
must both be ready before the publisher reports ready. Do not expose this
port through public ingress.

## Metrics and logs

Prometheus text metrics include:

```text
outbox_pending_total
outbox_oldest_pending_age_seconds
outbox_claimed_total
outbox_delivered_total
outbox_retry_total
outbox_publish_failure_total
outbox_lease_expired_total
outbox_publish_duration_seconds
```

Structured delivery logs include event ID/type, aggregate type/ID, revision,
topic, attempt, lease owner, duration, result, and sanitized error details.
Payloads are not logged.
