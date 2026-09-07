# CI/CD Pipeline — GitHub Actions

This project uses **GitHub Actions** for source verification and immutable
image publication. Kubernetes deployment remains owned by infra Git and ArgoCD.

## CI Workflow

The CI workflow runs on every push to `main`/`develop` and on pull requests
targeting those branches.

### Pipeline Steps

| Step | Trigger | Description |
|------|---------|-------------|
| Build | All branches | Compiles TypeScript via `nest build` |
| Lint | All branches | Runs ESLint with auto-fix on `src/` and `test/` |
| Unit Tests | All branches | Runs Jest unit tests in `src/` |
| Integration Tests | All branches | Runs integration tests in `test/` (includes PostgreSQL via Testcontainers) |
| **Docker Build** | Same-repository pull requests after CI | Builds the production image without publishing it |
| **Docker Build & Push** | Branch/tag pushes after CI | Builds and publishes `ghcr.io/nexus-estate/nexus-api:<full-sha>` with `packages: write` |

The Docker build mounts a temporary `.npmrc` containing the CI dependency
token only for the `npm ci` step. The token is not a Docker build argument and
is not copied into the final image. Fork pull requests do not receive private
package secrets, so the production Docker build job is skipped for them.

### Image Tag Strategy

| Branch | Image Tag | Example |
|--------|-----------|---------|
| `develop` | full 40-character SHA, optional `develop-latest` | `<full-sha>` |
| `main` | full 40-character SHA, optional `latest` | `<full-sha>` |

### Workflow File

Located at `.github/workflows/ci.yml`.

The workflow uses the dynamic repository owner in image metadata, producing:

```text
ghcr.io/nexus-estate/nexus-api:<sha>
```

## Environment Variables

The CI workflow sets these environment variables for the test database:

| Variable | CI Value |
|----------|----------|
| `DB_POSTGRES_HOST` | `localhost` |
| `DB_POSTGRES_PORT` | `5432` |
| `DB_POSTGRES_USER` | `test` |
| `DB_POSTGRES_PASS` | `test` |
| `DB_POSTGRES_NAME` | `nexus_estate_test` |
| `JWT_SECRET` | `ci-test-secret` |

## Pre-commit Hook

A pre-commit hook (via Husky) runs before each commit:

1. `lint-staged` — ESLint fix + Prettier format on staged `.ts` files
2. `test:all` — Full pipeline: `build → lint → test → test:e2e`

This ensures code quality before any code reaches the repository.

## Local Full Check

Run the complete CI pipeline locally:

```bash
npm run test:all
```

This executes: `build → lint → unit tests → integration tests`.
