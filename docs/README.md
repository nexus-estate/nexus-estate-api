# Nexus Estate API Gateway — Documentation

This directory is the **single source of truth** for all project documentation.

## Documents

| File | Description |
|------|-------------|
| [developer.rules.md](./developer.rules.md) | **Architecture, conventions, shared contracts, and development rules** |
| [local-development.md](./local-development.md) | Local development environment setup guide |
| [ci-pipeline.md](./ci-pipeline.md) | CI pipeline with GitHub Actions (build, lint, test) |

## Architecture Overview

```
Client Apps ──▶ API Gateway (NestJS) ──▶ PostgreSQL
                     │
                     ├── Auth Module (JWT + Passport)
                     ├── User Module (CRUD + Password)
                     ├── RBAC Module (Roles + Permissions)
                     │
                     ├── Abstraction Layer
                     │   ├── BaseEntity (UUID, timestamps, audit, soft-delete)
                     │   ├── ApprovalBaseEntity (approval workflow)
                     │   ├── BaseRepository<T> (generic CRUD)
                     │   ├── BaseService<T> (generic business logic)
                     │   └── BaseQueryBuilder<T> (fluent queries)
                     │
                     └── Common Layer (filters, interceptors, guards, helpers)
```

## Shared Contracts

The `shared-contracts` repository (`../shared-contracts`) defines API contracts shared across all services and frontend:

- **OpenAPI specs** — Public, Broker, and Admin API definitions
- **Schemas** — User, Property, Listing, Lead, Media, Payment
- **Error codes** — Standardized error codes with i18n (EN/VI)
- **Events** — 10 domain event schemas (JSON Schema)
- **Proto** — gRPC definitions (Search, Recommendation, Media)
- **TypeScript SDK** — `@nexus-estate/typescript-sdk` for frontend integration
- **Go clients** — For microservice consumers
- **Mock server** — Express.js on port 4010 for frontend development

See [developer.rules.md § Shared Contracts](./developer.rules.md#13-shared-contracts) for full details and usage examples.

## CI/CD Strategy

- **CI (this repository):** Automated via GitHub Actions — build, lint, unit tests, and integration tests run on every push and pull request. See [ci-pipeline.md](./ci-pipeline.md).
- **CD (separate repository):** Deployment is managed in a dedicated infrastructure repository.

## Quick Reference

```bash
# Local development
npm run start:dev       # Start with hot-reload
npm run build           # Build project
npm run lint            # Lint with auto-fix
npm test                # Run unit tests
npm run test:e2e        # Run integration tests
npm run test:all        # Full pipeline: build + lint + unit + integration

# Database
npm run migration:run     # Run pending migrations
npm run migration:revert  # Revert last migration
```

## For New Developers

1. Read [local-development.md](./local-development.md) to set up your environment
2. Read [developer.rules.md](./developer.rules.md) to understand the architecture and conventions
3. Review [ci-pipeline.md](./ci-pipeline.md) to understand the CI process