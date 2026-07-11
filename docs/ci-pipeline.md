# CI Pipeline — GitHub Actions

This project uses **GitHub Actions** for Continuous Integration. There is no Continuous Deployment (CD) configured in this repository — CD is managed in a separate infrastructure repository.

## Workflow

The CI workflow runs on every push to `main`/`develop` and on pull requests targeting those branches.

### Pipeline Steps

| Step | Command | Description |
|------|---------|-------------|
| Build | `npm run build` | Compiles TypeScript via `nest build` |
| Lint | `npm run lint` | Runs ESLint with auto-fix on `src/` and `test/` |
| Unit Tests | `npm test` | Runs Jest unit tests in `src/` |
| Integration Tests | `npm run test:e2e` | Runs integration tests in `test/` (includes PostgreSQL via Testcontainers) |

### Workflow File

Located at `.github/workflows/ci.yml`.

```yaml
name: CI
on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

jobs:
  ci:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:18-alpine
        env:
          POSTGRES_USER: test
          POSTGRES_PASSWORD: test
          POSTGRES_DB: nexus_estate_test
        ports:
          - 5432:5432

    steps:
      - Checkout
      - Setup Node.js (from .nvmrc)
      - npm ci
      - npm run build
      - npm run lint
      - npm test
      - npm run test:e2e
```

### Environment Variables

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

A pre-commit hook (via [Husky](https://typicode.github.io/husky/)) runs before each commit:

1. **lint-staged** — ESLint fix + Prettier format on staged `.ts` files
2. **test:all** — Full pipeline: `build → lint → test → test:e2e`

This ensures code quality before any commit reaches the repository.

## Local Full Check

Run the complete CI pipeline locally:

```bash
npm run test:all
```

This executes: `build → lint → unit tests → integration tests`.