# CI/CD Pipeline — GitHub Actions

This project uses GitHub Actions for source verification and immutable image
publication. Kubernetes deployment remains owned by infra Git and ArgoCD.

## Pull requests

Every pull request targeting `main` or `develop` runs:

1. `npm ci`
2. `npm run build`
3. `npm run typecheck`
4. `npm run lint:check`
5. `npm test -- --no-coverage`
6. `npm run test:e2e -- --no-coverage` with PostgreSQL/Testcontainers
7. `npm run migration:check`
8. A production Docker build

The API has no private npm dependency or registry credential on this path, so
the Docker validation also runs for fork pull requests.

## Pushes and tags

Pushes to `main`, `develop`, and version tags run the same verification job,
then build and publish the production image to GHCR. Images use the full commit
SHA; `develop-latest` and `latest` are also published for their respective
branches.

## Test database

The workflow provisions PostgreSQL with these values:

| Variable | CI value |
|----------|----------|
| `DB_POSTGRES_HOST` | `localhost` |
| `DB_POSTGRES_PORT` | `5432` |
| `DB_POSTGRES_USER` | `test` |
| `DB_POSTGRES_PASS` | `test` |
| `DB_POSTGRES_NAME` | `nexus_estate_test` |
| `JWT_SECRET` | `ci-test-secret` |

## Local verification

```bash
npm ci
npm run build
npm run typecheck
npm run lint:check
npm test -- --no-coverage
npm run test:e2e -- --no-coverage
npm run migration:check
docker build --target production .
```

Or run the application checks as one command:

```bash
npm run test:all
```

`npm run lint:check` is read-only and is used by CI. Use `npm run lint:fix`
when intentionally applying ESLint fixes locally.
