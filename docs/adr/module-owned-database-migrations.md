# ADR: Module-owned database migrations

## Status

Accepted for the ProviderAccount foundation and future modules.

## Decision

Schema migrations are owned by the aggregate or module whose persistence
contract they change. They live in that module's `migrations/` directory. A
change that spans modules or belongs to shared database infrastructure lives in
`src/database/migrations/platform/`. The current module-owned directories are
Customer account, RBAC, Estate, Location, Media, and Provider Platform account.
DataPool and the former DataPool lifecycle are now represented by Customer
account-owned migrations. The cross-module index cleanup is owned by RBAC
because it cleans up Customer/RBAC
unique indexes together with the RBAC schema history.

Historical files were physically reorganized without changing their class
names, timestamps, or SQL behavior, so the recorded TypeORM migration
identities remain unchanged.

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

The ProviderAccount legacy owner backfill is a data migration because it creates
business records from existing Estate and Customer account data; it is not seed
data.

## Verification

`npm run migration:verify` is intentionally domain-agnostic. It creates a
temporary PostgreSQL database, initializes the same TypeORM migration config as
the application, runs every discovered migration, verifies that no migration is
pending, verifies applied count and migration-name uniqueness, checks timestamp
ordering, and destroys the temporary database. It does not assert any feature
table, column, or latest-migration behavior.

Feature-specific persistence contracts belong in feature-owned integration
tests. Therefore ProviderAccount schema assertions live in
`test/integration/migrations/provider-account.migration.integration-spec.ts`, and
future Property or Listing migration tests can be added without changing the
generic verifier.

## Consequences

This keeps migration ownership discoverable as the module tree grows while
preserving one global TypeORM migration history. A controlled baseline or
archive strategy is deferred until replay cost becomes a demonstrated
operational problem.
