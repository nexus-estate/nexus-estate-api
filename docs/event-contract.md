# API to Engine Event Contract

## Ownership and delivery status

PostgreSQL and the API own canonical business state and source revisions. The
Engine consumes events to maintain projections; it must not generate source
revisions from timestamps, broker offsets, local counters, random IDs, or its
own clock.

This document freezes the v1 envelope and the listing-scoped revision rules.
This change does not publish or deliver events. There is no broker producer,
outbox table, dispatcher, Engine consumer, snapshot endpoint, or reindex
endpoint yet. `API-EVENT-02 Transactional Outbox` must insert each event in the
same database transaction as the business mutation and revision increment,
using the revision returned by the atomic increment.

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
- `eventType` names the payload schema and its compatible major version.
- `aggregateType` is a stable lowercase logical name. Marketplace listing
  events use `listing`.
- `aggregateId` identifies the projection stream. Marketplace listing events
  use the Listing UUID, not the Estate UUID.
- `revision` is a positive decimal string within PostgreSQL signed int64:
  `1` through `9223372036854775807`. TypeScript and wire representations stay
  strings; consumers compare their integer values without converting to
  JavaScript `number`.
- `occurredAt` is UTC ISO-8601 metadata. It is not an ordering signal.
- `traceId` is nullable propagation metadata. It does not affect ordering,
  idempotency, or payload identity.
- `payload` follows the schema named by `eventType`. This contract does not
  define the full Marketplace snapshot payload.

The TypeScript validator rejects invalid fields without normalizing them. The
contract types and validators live in `src/common/events/`.

## Event type versioning

Use `<domain>.<action>.v<major>` with lowercase domain and action names. An
action may use snake case. Examples:

```text
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

## Listing projection revision

`tbl_listing.projection_revision` is the persisted PostgreSQL `bigint` source
revision for the Marketplace projection. Each non-deleted Listing has its own
independent monotonic stream. Existing Listings start at baseline revision `1`
after migration, and newly created Listings start at `1`. Historical values
are not reconstructed from timestamps or lifecycle history.

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

## Ordering, retry, and rebuild assumptions

Consumers order events only within the same aggregate stream by `revision`.
They ignore an event whose revision is not newer than the projection's
revision. Revision gaps can be detected and retried or repaired by a future
snapshot/rebuild flow; timestamps and broker offsets cannot fill that role.

`eventId` supports duplicate detection when persisted by the future outbox.
Redelivery must retain the original event ID, aggregate identity, revision, and
payload. `traceId` is observability metadata only.

Until the outbox and producer are implemented, no event delivery or
event-driven indexing exists. This PR establishes the source ordering contract
only.

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
docker compose exec postgres psql -U postgres -d nexus_estate_dev \
  -c "SELECT id, fk_estate_id, status, projection_revision, updated_at FROM tbl_listing ORDER BY created_at DESC"
```

`projection_revision` should advance once after each committed source mutation
for a live Listing. Rejected requests leave it unchanged. The revision-only
update does not change `updated_at`.
