# Database migration conventions

- Migrations are append-only. Once a migration has reached a shared or deployed database, do not edit or rename it; add a new migration instead.
- New migration filenames use a unique current epoch-millisecond timestamp: `<timestamp>-<Description>.ts`.
- Keep one cohesive schema change per migration and make `down()` reverse the same change.
- Keep migrations free of application service imports. They should use only TypeORM's `QueryRunner` and migration-local SQL.
- Run `npm run migration:verify` before merge. The verifier creates a temporary database with the configured PostgreSQL admin connection (`DB_POSTGRES_ADMIN_NAME`, default `postgres`; the user needs `CREATEDB`/`DROP DATABASE` privileges), runs every discovered schema migration from an empty database, checks migration history and ordering, and drops the temporary database in all exit paths.

New aggregate-owned schema migrations belong in the owning module's `migrations/`
directory, for example
`src/modules/seller-platform/seller-account/migrations/`. Cross-module or
platform changes belong in `src/database/migrations/platform/`. The configured
TypeORM globs discover both locations and TypeORM orders migrations globally by
the timestamp suffix in each class name.

The current ownership layout is:

| Owner | Migration directory |
| --- | --- |
| User | `src/modules/user/migrations/` |
| RBAC | `src/modules/rbac/migrations/` |
| Estate | `src/modules/estate/migrations/` |
| Location | `src/modules/location/migrations/` |
| Media | `src/modules/media/migrations/` |
| SellerAccount | `src/modules/seller-platform/seller-account/migrations/` |

The platform directory is reserved for future shared or cross-module
migrations; it currently contains only its README. The historical DataPool
creation and its removal are User-owned because the table was part of the User
data model and has no active runtime consumer.

Historical files were physically reorganized without changing their migration
class names, timestamps, or SQL behavior. TypeORM therefore retains the same
migration identities while the directory tree reflects ownership.

Business-data transformations are data migrations, not seeds. Keep them in the
owning module's `data-migrations/` directory and run them through an explicit
script such as `npm run backfill:seller-account`. Use `src/database/seed/` only
for reference/bootstrap data.

Production uses the compiled artifact: run `npm run migration:run:prod` (or
`npm run migration:show:prod`) from the immutable image. CI verifies this same
compiled path with `npm run migration:verify:prod`.

The legacy migration set contains historical timestamp collisions. They are intentionally left unchanged because migration identity is part of the database history; all new migrations must use unique timestamps.
