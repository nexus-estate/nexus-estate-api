# API to Engine Event Contract

## Ownership and delivery status

PostgreSQL and the API own canonical business state and source revisions. The
Engine consumes events to maintain projections; it must not generate source
revisions from timestamps, broker offsets, local counters, random IDs, or its
own clock.

This document freezes the v1 envelope and the listing-scoped revision rules.
`API-EVENT-02` persists Marketplace Listing envelopes in PostgreSQL in the
same transaction as each supported business mutation and revision increment.
`API-EVENT-03` adds independent at-least-once delivery to Kafka; the Engine
consumer, snapshot endpoint, and reindex endpoint remain future work. See
[`docs/outbox-contract.md`](outbox-contract.md) for storage and payload details
and [`docs/outbox-delivery-contract.md`](outbox-delivery-contract.md) for
delivery semantics.

## Envelope

Every event uses this serialized shape:

```ts
interface EventEnvelope<TPayload> {
  eventId: string;
  eventType: string;
  aggregateType: string;
  aggregateId: string;
  revision: string;
  occurredAt: string;
  traceId: string | null;
  payload: TPayload;
}
```

- `eventId` is a UUID. A retry or redelivery keeps the same ID; a producer
  creates and persists it with the event.
- `eventType` describes the event meaning and payload schema version.
- `aggregateType` is a stable lowercase logical name.
- `aggregateId` identifies one aggregate instance.
- `revision` is a positive decimal string within PostgreSQL signed int64:
  `1` through `9223372036854775807`. TypeScript and wire representations stay
  strings; consumers compare their integer values without converting to
  JavaScript `number`. It is monotonic within the exact aggregate stream
  identified by `(aggregateType, aggregateId)`.
- `occurredAt` is UTC ISO-8601 metadata. It is not an ordering signal.
- `traceId` is nullable propagation metadata. It does not affect ordering,
  idempotency, or payload identity.
- `payload` follows the schema named by `eventType`. This contract does not
  define the full Marketplace snapshot payload.

The TypeScript validator rejects invalid fields without normalizing them. The
contract types and validators live in `src/common/events/`.

`eventType` and aggregate identity are related but distinct: `eventType`
describes event meaning/schema, while `(aggregateType, aggregateId)` selects
the revision stream. A revision value must come from that exact aggregate's
source revision.

## Event type versioning

Use `<domain>.<action>.v<major>` with lowercase domain and action names. An
action may use snake case. Examples:

```text
listing.search_projection_changed.v1
listing.published.v1
listing.updated.v1
listing.archived.v1
listing.restored.v1
property.created.v1
property.updated.v1
property.archived.v1
media.created.v1
media.updated.v1
media.deleted.v1
```

Do not omit the version or silently change a payload incompatibly under the
same event type. A breaking payload change gets a new major version.

The generic examples `property.updated.v1` and `media.updated.v1` only describe
possible independent domain events. If implemented as ordered aggregate events,
they must use the Property or Media aggregate's own revision stream (or define
a separate ordering contract). They must not reuse
`listing.projection_revision`. Until a corresponding source revision exists,
these examples do not claim ordered aggregate-event semantics.

## Listing projection revision

`tbl_listing.projection_revision` is the persisted PostgreSQL `bigint` source
revision for the Marketplace Listing aggregate stream. Each non-deleted Listing
has its own independent monotonic stream. Existing Listings start at baseline
revision `1` after migration, and newly created Listings start at `1`.
Historical values are not reconstructed from timestamps or lifecycle history.

`listing.projection_revision` may be serialized as `EventEnvelope.revision`
only when `aggregateType = listing` and `aggregateId = listing.id`. It cannot
order an event whose aggregate is Property, Media, or another entity.

Increments use one atomic PostgreSQL update in the caller's transaction. The
increment does not change `Listing.updatedAt`. A successful logical mutation
bumps once, even if it changes multiple fields. A rollback, rejected command,
validation failure, or authorization failure does not consume a revision.

### Current bump matrix

| Mutation                                                | Live Listing exists? | Committed result          |
| ------------------------------------------------------- | -------------------: | ------------------------- |
| Create Listing                                          |                  New | Starts at `1`             |
| Publish Listing                                         |                  Yes | `+1`                      |
| Archive Listing                                         |                  Yes | `+1`                      |
| Estate update                                           |                   No | No Listing row is created |
| Estate update                                           |                  Yes | `+1`                      |
| Estate activate, archive, or restore                    |                  Yes | `+1`                      |
| Estate soft-delete                                      |                  Yes | `+1`                      |
| Invalid, unauthorized, blocked, or rolled-back mutation |                  Any | Unchanged                 |

Estate lifecycle and update commands serialize on the Estate row. Listing
publish and archive use the same lock, so concurrent committed mutations for
one Listing receive distinct consecutive revisions. Archiving or deleting an
Estate while a published Listing blocks the command leaves both state and
revision unchanged.

## Marketplace Listing event ownership

Marketplace indexing is a Listing projection. An event that tells Engine to
rebuild or apply a Marketplace Listing document therefore belongs to the
Listing aggregate stream, even when the source mutation was made to Estate,
Property, Media, location-derived data, or future Provider display data.

The canonical derived projection-change event is
`listing.search_projection_changed.v1`. Its aggregate identity and revision
source are always:

```text
aggregateType = listing
aggregateId   = listing.id
revision      = listing.projection_revision
```

For example, a Property update with an existing Listing may increment that
Listing's source revision and later produce a Listing-scoped projection event.
It is not a generic `property.updated.v1` event carrying a Listing revision. A
source mutation with no Listing produces no Marketplace Listing event.

| Source mutation | Event type | Aggregate type | Aggregate ID | Revision source |
| --- | --- | --- | --- | --- |
| Listing created | Future contract decision | `listing` | `listing.id` | `listing.projection_revision` |
| Listing published | `listing.published.v1` | `listing` | `listing.id` | `listing.projection_revision` |
| Listing archived | `listing.archived.v1` | `listing` | `listing.id` | `listing.projection_revision` |
| Listing restored | `listing.restored.v1` | `listing` | `listing.id` | `listing.projection_revision` |
| Property updated and Listing exists | `listing.search_projection_changed.v1` | `listing` | `listing.id` | `listing.projection_revision` |
| Property lifecycle changed and Listing exists | `listing.search_projection_changed.v1` | `listing` | `listing.id` | `listing.projection_revision` |
| Media changed and affects Listing | `listing.search_projection_changed.v1` | `listing` | `listing.id` | `listing.projection_revision` |
| Property changed without Listing | No Marketplace Listing event | n/a | n/a | n/a |

The producer matrix for implemented Listing and Estate commands is frozen in
[`docs/outbox-contract.md`](outbox-contract.md). Listing creation emits
`listing.search_projection_changed.v1` at revision `1` with a tombstone because
the new Listing starts in DRAFT. Listing restore remains unimplemented; the row
documents the expected aggregate/revision ownership if that command is added.

## Ordering, retry, and rebuild assumptions

Consumers compare revisions only within the same
`(aggregateType, aggregateId)` stream. For an incoming event and the stored
projection revision, the canonical result is:

| Incoming revision | Payload identity | Result |
| --- | --- | --- |
| Greater than current | Any | `APPLY` |
| Equal to current | Same logical canonical payload | `NOOP` |
| Less than current | Any | `REJECT_STALE` |
| Equal to current | Different logical canonical payload | `REVISION_CONFLICT` |

`NOOP` is a valid duplicate delivery: the consumer must not mutate the
projection or treat the event as a new revision. Same revision alone does not
prove duplication. Same revision with a different logical canonical payload
is a contract violation and must not be silently ignored. A future Engine
consumer must detect and report this condition through logging/metrics and
quarantine, DLQ, or other conflict handling. That operational handling is not
implemented here.

This contract defines payload identity semantically as the same or different
logical canonical payload. A future Engine implementation may use a
deterministic canonical payload hash, but the hash algorithm and serialization
canonicalization are not frozen by API-EVENT-01.

Revision gaps may be detected and retried or repaired by a future
snapshot/rebuild flow; timestamps and broker offsets cannot fill that role.

`eventId` supports delivery-level duplicate detection. The publisher sends the
persisted envelope and may redeliver it after a crash between broker
acknowledgement and the database delivery mark. Redelivery retains the
original event ID, aggregate identity, revision, occurrence time, trace ID,
and payload. `traceId` is observability metadata only.

The API persists the event ID, revision, payload, and occurred-at value before
the source transaction commits. The independent publisher transports
persisted rows unchanged. Delivery is at-least-once, so a future Engine
consumer must handle duplicate event IDs and revision-equivalent records.

## Local Docker verification

The integration and HTTP suites use PostgreSQL 18 Testcontainers. From the API
repository, run them with the local Docker daemon available:

```bash
npm run test:e2e -- --runInBand \
  test/integration/migrations/listing-projection-revision.migration.integration-spec.ts
npm run test:e2e -- --runInBand \
  test/integration/listing-projection-revision.integration-spec.ts
npm run test:e2e -- --runInBand test/estate/property.spec.ts
```

For a clean Compose migration and API health check, configure the repository's
`.env` first. `docker compose down -v --remove-orphans` deletes this repository's
local Compose volumes:

```bash
docker compose down -v --remove-orphans
docker compose build nexus-api
docker compose up -d postgres
docker compose ps
docker compose logs postgres
docker compose run --rm nexus-api npm run migration:check-timestamps
docker compose run --rm nexus-api npm run migration:run
docker compose run --rm nexus-api npm run migration:show
docker compose up -d nexus-api
curl -fsS http://localhost:50001/health/live
curl -fsS http://localhost:50001/health/ready
```

Inspect the persisted contract with:

```bash
docker compose exec postgres psql -U postgres -d nexus_estate \
  -c "SELECT id, fk_estate_id, status, projection_revision, updated_at FROM tbl_listing ORDER BY created_at DESC"
```

Replace `nexus_estate` with the database configured by `DB_POSTGRES_NAME` in
the local `.env` when it differs.

`projection_revision` should advance once after each committed source mutation
for a live Listing. Rejected requests leave it unchanged. The revision-only
update does not change `updated_at`.
