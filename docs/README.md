# Nexus Estate API Gateway — Documentation

This directory is the **single source of truth** for all project documentation.

## Documents

| File | Description |
|------|-------------|
| [developer.rules.md](./developer.rules.md) | **Architecture, conventions, and development rules** |
| [local-development.md](./local-development.md) | Local development environment setup guide |
| [ci-pipeline.md](./ci-pipeline.md) | CI pipeline with GitHub Actions (build, lint, test) |

## Architecture Overview

```
Client Apps ──▶ API Gateway (NestJS) ──▶ PostgreSQL
                     │
                     ├── Customer Module (customer account + customer authentication)
                     ├── Provider Platform (provider onboarding + supply ownership)
                     ├── Administration (internal portal + admin authentication)
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

## API Contract

The NestJS application is the source of truth for its REST API implementation.
Use `@nestjs/swagger` decorators and the generated Swagger document to expose
and review the current OpenAPI contract. Cross-service search communication is
owned by the engine repository's local proto definitions, not by a runtime
package dependency in this API.

## CI/CD Strategy

- **CI (this repository):** Automated via GitHub Actions — build, lint, unit tests, and integration tests run on every push and pull request. See [ci-pipeline.md](./ci-pipeline.md).
- **CD (separate repository):** Deployment is managed in a dedicated infrastructure repository.

## Quick Reference

```bash
# Local development
npm ci                    # Install the locked dependency graph
npm run start:dev         # Start with hot-reload
npm run build             # Build project
npm run lint:check        # Read-only lint check
npm run lint:fix          # Apply ESLint fixes locally
npm test                  # Run unit tests
npm run test:e2e          # Run integration tests
npm run test:all          # Full pipeline: build + lint + unit + integration

# Database
npm run migration:run     # Run pending migrations
npm run migration:run:prod # Run compiled migrations inside the production image
npm run migration:revert  # Revert last migration
```

## For New Developers

1. Read [local-development.md](./local-development.md) to set up your environment
2. Read [developer.rules.md](./developer.rules.md) to understand the architecture and conventions
3. Review [ci-pipeline.md](./ci-pipeline.md) to understand the CI process
