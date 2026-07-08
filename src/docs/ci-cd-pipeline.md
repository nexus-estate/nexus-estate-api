# CI/CD Pipeline Documentation

This document explains the complete CI/CD pipeline for the Nexus Estate API Gateway service.

## Pipeline Overview

```
┌──────────────────────────────────────────────────────────────────────────┐
│                         CI/CD Pipeline Flow                              │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  1. Developer pushes code to GitHub                                      │
│     ├─ feature branch → GitHub Actions (lint + build + test)             │
│     └─ main branch    → GitHub Actions (lint + build + test + push)     │
│                                                                          │
│  2. GitHub Actions (CI)                                                  │
│     ├─ Lint: ESLint check with Prettier formatting                       │
│     ├─ Build: TypeScript compilation via NestJS                         │
│     ├─ Unit Tests: Jest with coverage                                    │
│     ├─ Integration Tests: Testcontainers with PostgreSQL                │
│     └─ Docker Build & Push: Multi-stage build to GHCR                   │
│                                                                          │
│  3. Docker Image pushed to GHCR                                          │
│     └─ Tags: latest, <branch>, <commit-sha>                              │
│                                                                          │
│  4. Argo CD detects changes to k8s manifests in Git repo                 │
│     ├─ Reads: api-gateway/k8s/overlays/production/                      │
│     ├─ Compares: Desired state (Git) vs Actual state (k3s cluster)      │
│     └─ Syncs: Applies changes automatically                             │
│                                                                          │
│  5. k3s Cluster (VMware Ubuntu)                                         │
│     ├─ Pulls new Docker image from GHCR                                  │
│     ├─ Rolling update of Deployment pods                                 │
│     └─ Liveness/Readiness probes ensure zero-downtime                   │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

## Directory Structure

```
nexus-estate/
├── .github/
│   └── workflows/
│       ├── ci.yml              # Main CI pipeline
│       └── pr.yml              # PR validation workflow
├── api-gateway/
│   ├── src/
│   │   ├── main.ts             # Application entry point
│   │   ├── app.module.ts       # Root module
│   │   ├── database/
│   │   │   └── type.config.ts  # TypeORM configuration
│   │   └── docs/               # Documentation
│   ├── test/
│   │   ├── app.e2e-spec.ts     # End-to-end tests
│   │   ├── jest-e2e.json       # E2E test configuration
│   │   └── integration/
│   │       └── database.integration-spec.ts  # Integration tests
│   ├── k8s/
│   │   ├── base/               # Base Kubernetes manifests
│   │   ├── overlays/
│   │   │   ├── production/     # Production overlay
│   │   │   └── staging/        # Staging overlay
│   │   └── argocd/
│   │       └── application.yaml # Argo CD Application manifest
│   └── Dockerfile              # Multi-stage Docker build
└── README.md
```

## CI Pipeline (GitHub Actions)

### Workflow: `.github/workflows/ci.yml`

The CI pipeline is triggered on:

- **Push** to `main` or `master` branches (when files in `api-gateway/` change)
- **Pull requests** targeting `main` or `master`

#### Jobs

| Job | Purpose | Dependencies |
|-----|---------|-------------|
| `lint` | Run ESLint to check code quality | None |
| `build` | Compile TypeScript with NestJS | None |
| `unit-tests` | Run unit tests with Jest + coverage | None |
| `integration-tests` | Run integration tests using Testcontainers | None |
| `docker-build-push` | Build and push Docker image to GHCR | All above (only on push to main) |

#### Docker Image Tags

The Docker image is tagged with:

- `latest` — When pushed to the default branch
- `main` or `master` — Branch name
- `<short-sha>` — Git commit SHA (7 characters)
- `<semver>` — When a Git tag is pushed

See the [CI workflow file](../../../.github/workflows/ci.yml) for the full configuration.

## CD Pipeline (Argo CD)

### Application Manifest

The Argo CD Application manifest is at `api-gateway/k8s/argocd/application.yaml`.

Key configuration:

```yaml
source:
  repoURL: https://github.com/tiesn/nexus-estate.git
  targetRevision: main
  path: api-gateway/k8s/overlays/production

syncPolicy:
  automated:
    prune: true       # Remove resources no longer in Git
    selfHeal: true    # Revert manual changes to match Git
    allowEmpty: false
```

### Sync Strategy

1. Argo CD polls the Git repository every 3 minutes (default)
2. Detects changes in `api-gateway/k8s/` directory
3. Compares the desired state (manifests in Git) with the live state (k3s cluster)
4. Applies any differences automatically (auto-sync enabled)
5. Health checks ensure the application is running correctly

## Testing Strategy

### Unit Tests

Unit tests verify individual modules in isolation:

- **`app.module.spec.ts`** — Verifies the root module compiles and all dependencies are registered
- **`main.spec.ts`** — Verifies the application bootstraps correctly
- **`type.config.spec.ts`** — Verifies TypeORM configuration values

Run with:

```bash
cd api-gateway
npm run test          # Run unit tests
npm run test:cov      # Run with coverage report
```

### Integration Tests

Integration tests verify the application works with real dependencies using Testcontainers:

- **`database.integration-spec.ts`** — Spins up a PostgreSQL container, connects via TypeORM, and validates CRUD operations

Run with:

```bash
cd api-gateway
npm run test:e2e      # Run integration tests
```

Integration tests require Docker to be running on the CI machine (Testcontainers handles this automatically).

## Infrastructure Setup

### VMware Ubuntu VM

1. Create a VM with Ubuntu 24.04 LTS (8 GB RAM, 4 vCPUs, 40 GB disk)
2. Install k3s (lightweight Kubernetes)
3. Install Tailscale for secure team access
4. Install Argo CD for GitOps deployments

### Setup Guides

- [VMware Ubuntu Setup](./setup/vmware-ubuntu-setup.md)
- [k3s Installation](./setup/k3s-installation.md)
- [Tailscale Setup](./setup/tailscale-setup.md)
- [Argo CD Installation](./setup/argocd-installation.md)

## Environment Configuration

### Required GitHub Secrets

| Secret | Purpose |
|--------|---------|
| `GITHUB_TOKEN` | Automatically available, used for GHCR authentication |
| (Optional) `DOCKER_USERNAME` | If using Docker Hub instead of GHCR |
| (Optional) `DOCKER_PASSWORD` | If using Docker Hub instead of GHCR |

### Required Argo CD Configuration

| Item | Purpose |
|------|---------|
| GitHub SSH deploy key | Argo CD reads manifests from the repo |
| GHCR image pull secret | k3s pulls Docker images from GHCR |

## Monitoring and Alerts

### Argo CD Health Checks

Argo CD monitors the application health using:

- **Liveness Probe**: HTTP GET `/health` every 15 seconds
- **Readiness Probe**: HTTP GET `/health` every 10 seconds

### Application Logs

```bash
# View logs of all pods
kubectl logs -n nexus-estate -l app=api-gateway

# View Argo CD sync history
argocd app get api-gateway
```

## Rollback Procedure

If a deployment causes issues, roll back to a previous version:

### Via Argo CD CLI

```bash
# List deployment history to find the revision
argocd app get api-gateway

# Rollback to a specific revision
argocd app rollback api-gateway <REVISION_ID>
```

### Via Git Revert

```bash
# Revert the last commit in the k8s directory
git revert HEAD

# Push the revert
git push origin main

# Argo CD will automatically sync the reverted state