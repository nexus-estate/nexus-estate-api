# Database migration conventions

- Migrations are append-only. Once a migration has reached a shared or deployed database, do not edit or rename it; add a new migration instead.
- New migration filenames use a unique current epoch-millisecond timestamp: `<timestamp>-<Description>.ts`.
- Keep one cohesive schema change per migration and make `down()` reverse the same change.
- Keep migrations free of application service imports. They should use only TypeORM's `QueryRunner` and migration-local SQL.
- Run `npm run migration:verify` before merge. The verifier creates a temporary database with the configured PostgreSQL admin connection (`DB_POSTGRES_ADMIN_NAME`, default `postgres`; the user needs `CREATEDB`/`DROP DATABASE` privileges), runs every migration from an empty database, checks migration history and final schema invariants, exercises the latest revert/run cycle, and drops the temporary database in all exit paths.

The legacy migration set contains historical timestamp collisions. They are intentionally left unchanged because migration identity is part of the database history; all new migrations must use unique timestamps.
