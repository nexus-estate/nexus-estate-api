# ADR: Module-owned database migrations

## Status

Accepted for the SellerAccount foundation and future modules.

## Decision

Schema migrations are owned by the aggregate or module whose persistence
contract they change. They live in that module's `migrations/` directory. A
change that spans modules or belongs to shared database infrastructure lives in
`src/database/migrations/platform/`. Existing historical migrations remain in
the central directory so their deployed identity and replay behavior are not
changed by a reorganization.

The SellerAccount migration is the exception to the physical-location rule in
that it moved from the legacy directory, but its existing class name and
timestamp were preserved so the recorded TypeORM migration identity remains
unchanged.

TypeORM discovers both central and module-owned schema migration directories.
Folder hierarchy does not define execution order: the timestamp suffix in the
migration class name controls global ordering. Migration files and classes are
append-only after they are shared or deployed; later schema changes use new
migrations.

## Schema migrations, data migrations, and seeds

- Schema migrations change database structure and live in `migrations/`.
- Data migrations transform existing business data and live in
  `data-migrations/`. They are run explicitly and should be idempotent when
  operationally practical.
- Seeds bootstrap reference or development data and remain in
  `src/database/seed/`.

The SellerAccount legacy owner backfill is a data migration because it creates
business records from existing Estate and User data; it is not seed data.

## Verification

`npm run migration:verify` is intentionally domain-agnostic. It creates a
temporary PostgreSQL database, initializes the same TypeORM migration config as
the application, runs every discovered migration, verifies that no migration is
pending, verifies applied count and migration-name uniqueness, checks timestamp
ordering, and destroys the temporary database. It does not assert any feature
table, column, or latest-migration behavior.

Feature-specific persistence contracts belong in feature-owned integration
tests. Therefore SellerAccount schema assertions live in
`test/integration/migrations/seller-account.migration.integration-spec.ts`, and
future Property or Listing migration tests can be added without changing the
generic verifier.

## Consequences

This keeps migration ownership discoverable as the module tree grows while
preserving one global TypeORM migration history. A controlled baseline or
archive strategy is deferred until replay cost becomes a demonstrated
operational problem.
