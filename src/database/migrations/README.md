# Database migration conventions

- Migrations are append-only. Once a migration has reached a shared or deployed database, do not edit or rename it; add a new migration instead.
- Before creating a migration, run `date +%s%3N` and use its 13-digit
  Unix-millisecond timestamp: `<timestamp>-<Description>.ts`.
- Keep one cohesive schema change per migration and make `down()` reverse the same change.
- Keep migrations free of application service imports. They should use only TypeORM's `QueryRunner` and migration-local SQL.
- Run `npm run migration:verify` before merge. The verifier creates a temporary database with the configured PostgreSQL admin connection (`DB_POSTGRES_ADMIN_NAME`, default `postgres`; the user needs `CREATEDB`/`DROP DATABASE` privileges), runs every discovered schema migration from an empty database, checks migration history and ordering, and drops the temporary database in all exit paths.

All schema migrations belong in the concrete owning module's `migrations/`
directory, for example
`src/modules/provider/account/migrations/`. Cross-module or platform changes
must still choose an explicit owning module; `src/database/migrations/` is not a
valid schema-migration location. TypeORM discovers module-owned migrations
recursively and orders them globally by the 13-digit Unix-millisecond timestamp
in the filename and class name, never by directory order or a relative
sequence number.

The current ownership layout is:

| Owner | Migration directory |
| --- | --- |
| Customer account | `src/modules/customer/account/migrations/` |
| Administration authentication | `src/modules/administration/authentication/migrations/` |
| Administration authorization | `src/modules/administration/authorization/migrations/` |
| RBAC compatibility | `src/modules/rbac/legacy-global/migrations/` |
| Estate property | `src/modules/estate/property/migrations/` |
| Location | `src/modules/location/administrative-division/migrations/` |
| Media asset | `src/modules/media/asset/migrations/` |
| Provider account | `src/modules/provider/account/migrations/` |

The historical DataPool creation and its removal are Customer-account-owned
because the table was part of the customer data model and has no active runtime
consumer.

Historical migration files were physically moved into their owning modules and
their timestamp/class identities were normalized for a fresh database. Their
SQL behavior and file contents were preserved. Existing deployed databases
must be handled with the repository's normal migration-history compatibility
process; do not repeat this normalization against a shared database.

Business-data transformations are data migrations, not seeds. Keep them in the
owning module's `data-migrations/` directory and run them through an explicit
script such as `npm run backfill:provider-account`. Use `src/database/seed/` only
for reference/bootstrap data.

Production uses the compiled artifact: run `npm run migration:run:prod` (or
`npm run migration:show:prod`) from the immutable image. CI verifies this same
compiled path with `npm run migration:verify:prod`.

The migration set was normalized for fresh-database bootstrap: legacy
timestamps were converted to valid, ordered TypeORM Unix-millisecond
identities. All new migrations must begin by running `date +%s%3N` and use the
next available millisecond if more than one migration is created at the same
instant while preserving order.
