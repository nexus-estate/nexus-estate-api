# Security and Runtime Operations

## Authentication configuration

Customer and administration access tokens use separate signing keys. Each
realm also has a separate refresh signing key:

- `CUSTOMER_JWT_ACCESS_SECRET` / `CUSTOMER_JWT_REFRESH_SECRET`
- `ADMIN_JWT_ACCESS_SECRET` / `ADMIN_JWT_REFRESH_SECRET`

Access tokens contain `realm=customer|administration`,
`tokenType=access`, and a `sessionId`. Refresh tokens use the same realm with
`tokenType=refresh`. Refresh tokens are stored only as SHA-256 hashes in
`tbl_auth_session`, rotated on use, and revoked on logout or reuse detection.

Token expiry is controlled independently by the four `*_EXPIRES_IN` variables.
Refresh sessions also have a bounded absolute lifetime. A signing-key rotation
invalidates tokens signed by the previous key; multi-key `kid` rotation is a
future enhancement.

Legacy `JWT_SECRET`, `JWT_REFRESH_SECRET`, `ADMIN_JWT_SECRET`, and
`CORS_ORIGIN` names are accepted as migration aliases where safe. They should
not be used for new deployments. Administration never falls back to a customer
secret.

The authorization migration provisions one active `SUPER_ADMIN` recovery
identity and assigns the complete Administration catalogue to that role. Set
`INITIAL_ADMIN_EMAIL` and `INITIAL_ADMIN_PASSWORD` before running the migration
in a real environment; the `.env.example` values are placeholders only.

## HTTP exposure

Production requires an explicit comma-separated HTTP(S) `CORS_ORIGINS` list;
`*` is rejected. Swagger is controlled by `SWAGGER_ENABLED` and defaults off
in production. Development defaults to localhost origins and Swagger enabled.
The application sets baseline security headers and `TRUST_PROXY_HOPS` defaults
to `0`; increase it only when the ingress topology is known and documented.

`x-request-id` is accepted only when it is at most 128 characters and contains
`A-Z`, `a-z`, `0-9`, `.`, `_`, `:`, or `-`. Otherwise the server generates a
UUID and returns that bounded value in the response header.

## Kubernetes probes and shutdown

- `GET /health/live` checks only that the process is alive.
- `GET /health/ready` runs `SELECT 1` against PostgreSQL.
- `/healthz` remains as a backwards-compatible liveness endpoint.

Nest shutdown hooks are enabled so HTTP and TypeORM resources can close during
termination. Schema migrations are run by the deployment process, not by each
replica at startup.
