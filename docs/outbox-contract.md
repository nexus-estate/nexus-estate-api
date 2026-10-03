# Transactional Outbox Contract

## Purpose and status

The API and PostgreSQL own canonical business state, Listing projection
revisions, and the durable Marketplace Listing events produced by supported
commands. Engine consumes those events in a later integration step. This
contract freezes the source event at commit time so a future publisher only
needs to transport the persisted row.

`tbl_outbox_event` is implemented. No broker connection, publisher,
dispatcher, delivery marker, retry worker, Engine consumer, Elasticsearch
write, snapshot endpoint, or reindex endpoint is implemented. Rows currently
remain in PostgreSQL.

## Transactional guarantee

For each supported Listing aggregate mutation, the API performs these writes
inside one PostgreSQL transaction:

```text
canonical business mutation
+ listing.projection_revision
+ tbl_outbox_event insert
= one atomic commit
```

The source transaction's `EntityManager` is required by revision, snapshot,
and outbox persistence. Snapshot reads use that same manager, so an event
captures the post-mutation state visible to the transaction. If snapshot
construction, envelope validation, or outbox insertion fails, the business
mutation and revision roll back with the event insert.

The outbox insert uses the exact revision returned by the atomic Listing
revision update. It never reads a revision after commit or derives one from a
timestamp. Estate commands with no live Listing do not create a Listing event.

## Table schema

The `eventing/outbox` feature owns
`src/modules/eventing/outbox/migrations/<timestamp>-CreateOutboxEventTable.ts`.
The table contains:

| Column | PostgreSQL type | Meaning |
| --- | --- | --- |
| `event_id` | `uuid` primary key | Stable event identity |
| `event_type` | `varchar(160)` | Versioned event meaning/schema |
| `aggregate_type` | `varchar(64)` | Aggregate stream type |
| `aggregate_id` | `uuid` | Aggregate stream identity |
| `revision` | `bigint` | Positive aggregate revision; TypeScript keeps a decimal string |
| `occurred_at` | `timestamptz` | Event materialization metadata, not ordering |
| `trace_id` | `varchar(128) null` | Request correlation; currently always null |
| `payload` | `jsonb` | Versioned payload captured at commit time |
| `created_at` | `timestamptz` | Database insertion metadata |

The database enforces `revision >= 1` and producer-key uniqueness over
`(aggregate_type, aggregate_id, revision, event_type)`. Indexes cover creation
order for a future dispatcher and aggregate revision lookup. No delivery state
is stored yet.

Outbox rows are append-only through the application boundary. `OutboxEventRepo`
only exposes `insert(envelope, manager)`; it has no update, delete, soft-delete,
or retry operation. `OutboxEvent` does not inherit the mutable business
`BaseEntity`.

## Producer ownership and envelope

Generic storage is owned by `EventingModule` and does not depend on business
modules. Listing owns the Marketplace event payload, source snapshot reader,
and orchestration service. Estate depends on that narrow Listing boundary for
Listing-scoped projection changes.

Marketplace events always identify the Listing aggregate:

```text
aggregateType = listing
aggregateId   = listing.id
revision      = listing.projection_revision
```

An Estate or future Media mutation that changes the Marketplace document does
not borrow the Listing revision for a Property or Media aggregate event. It
records a Listing-scoped projection event instead. Independent Property or
Media domain events require their own revision stream or separate ordering
contract.

Each outbox row gets one `randomUUID()` event ID and one UTC `occurredAt` value
when materialized. Redelivery must retain both values and the entire persisted
envelope. `traceId` is explicitly `null` because no domain-level request
context accessor exists yet; request correlation propagation is future
observability work.

## Marketplace Listing payload v1

`listing.search_projection_changed.v1`, `listing.published.v1`, and
`listing.archived.v1` use:

```ts
interface MarketplaceListingProjectionEventPayloadV1 {
  deleted: boolean;
  document: MarketplaceListingSnapshotV1 | null;
}
```

The snapshot is a transport contract, not a REST response or Elasticsearch
document:

```ts
interface MarketplaceListingSnapshotV1 {
  listing_id: string;
  property_id: string;
  title: string;
  description: string | null;
  type: string;
  purpose: string;
  price: string;
  area: string | null;
  province_id: string;
  province_name: string;
  ward_id: string;
  ward_name: string;
  address: string;
  location: { lat: string; lon: string } | null;
  media: { images: string[] };
  published_at: string;
  updated_at: string;
}
```

PostgreSQL numerics are selected as text. In particular, `price` is a decimal
integer string and remains exact above JavaScript's safe integer limit. Missing
description and area use explicit `null`; coordinates produce a location only
when both values exist; image URLs are always an array. Timestamps are emitted
as UTC ISO-8601 strings with PostgreSQL microsecond precision. `published_at`
comes from `tbl_listing.published_at`, and `updated_at` comes from
`tbl_listing.updated_at`. The latter is Listing audit/display metadata, not the
source revision; it may remain unchanged when Estate-derived projection data
changes. Ordering always uses `EventEnvelope.revision`.

## Searchability and tombstones

The API decides whether a Listing is searchable. A full document is emitted
only when the Listing exists and is not soft-deleted, Listing status is
`PUBLISHED`, the Estate exists and is not soft-deleted, and Estate status is
`ACTIVE`.

When any condition is false, the persisted payload is exactly:

```json
{"deleted":true,"document":null}
```

The snapshot reader deliberately includes soft-deleted source rows so it can
build tombstones. It reads only live image Media rows, ordered by
`sort_order ASC, media.id ASC`, with a maximum of 20. Videos and deleted media
are excluded. No cover image is inferred.

## Event emission matrix

| Source mutation | Revision behavior | Event type | Payload state |
| --- | ---: | --- | --- |
| Listing created as DRAFT | starts at `1` | `listing.search_projection_changed.v1` | tombstone |
| Listing published | `+1` | `listing.published.v1` | searchable snapshot |
| Listing archived | `+1` | `listing.archived.v1` | tombstone |
| Estate updated with a live Listing | `+1` | `listing.search_projection_changed.v1` | post-mutation state |
| Estate activated with a live Listing | `+1` | `listing.search_projection_changed.v1` | post-mutation state |
| Estate archived with a live Listing | `+1` | `listing.search_projection_changed.v1` | tombstone |
| Estate restored with a live Listing | `+1` | `listing.search_projection_changed.v1` | post-mutation state |
| Estate soft-deleted with a live Listing | `+1` | `listing.search_projection_changed.v1` | tombstone |
| Estate mutation without a live Listing | none | no Marketplace event | none |
| Rejected, unauthorized, blocked, or rolled-back command | none | no event | none |

One supported committed Listing revision produces exactly one Marketplace
outbox row. Listing publish/archive do not also emit a projection-changed row
at the same revision.

## Failure and concurrency semantics

The API serializes Listing creation and lifecycle operations with the existing
Estate row lock. Estate updates and lifecycle commands use that lock too. Each
committed command for one Listing therefore gets its own consecutive revision
and unique event row. Rejected transitions and authorization/validation
failures do not bump the revision or write an event.

The database unique constraint protects against duplicate producer writes for
the same aggregate revision and event type. If it rejects an insert, the
containing source transaction fails; no business state or revision from that
transaction commits. PostgreSQL integration and HTTP tests force this failure
for both an Estate update and Listing publish.

## Future source mutations

Any future mutation that can change Marketplace source state must be extended
to perform its canonical write, the affected Listing revision increment, and
the corresponding outbox insert in the same transaction. This applies to
Media changes that affect Listing images. Future Province/Ward name changes
need a deliberate fan-out/invalidation strategy for affected Listings; this
PR does not implement that behavior or Media CRUD.

## Publisher handoff

A future publisher may assume rows contain valid immutable EventEnvelope data,
the committed source revision, stable event ID, durable payload, and
materialization time. It must transport persisted rows without regenerating
`eventId`, `revision`, `payload`, or `occurredAt`. It must not rebuild a payload
from the current business tables because those rows may have advanced since
the event was committed.

This PR does not implement publisher polling, `SKIP LOCKED`, delivery markers,
attempt counters, retries, backoff, a dead-letter queue, or broker transport.

## Local Docker verification

With the Nexus Estate Compose environment configured, migrate and inspect the
real table:

```bash
docker compose run --rm nexus-api npm run migration:check-timestamps
docker compose run --rm nexus-api npm run migration:run
docker compose run --rm nexus-api npm run migration:show
docker compose exec postgres psql -U postgres -d nexus_estate \
  -c "SELECT event_id, event_type, aggregate_type, aggregate_id, revision::text, trace_id, payload FROM tbl_outbox_event ORDER BY created_at, event_id"
```

Replace `nexus_estate` with the database configured by `DB_POSTGRES_NAME` in
the local `.env` when it differs.

For a clean local Compose migration, `docker compose down -v
--remove-orphans` removes this repository's local volumes. After starting the
API, check `/health/live` and `/health/ready`. The E2E suite also exercises
real outbox rows, rollback on insert conflicts, concurrent revisions, and the
public response boundary with PostgreSQL 18 Testcontainers.
