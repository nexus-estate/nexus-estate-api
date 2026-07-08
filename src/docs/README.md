# Nexus Estate API Gateway Documentation

Welcome to the documentation for the **Nexus Estate API Gateway** service — a NestJS-based REST API that serves as the entry point for the Nexus Estate platform.

## Table of Contents

1. [CI/CD Pipeline](./ci-cd-pipeline.md) — Complete CI/CD workflow with GitHub Actions and Argo CD
2. [Local Development](./local-development.md) — How to set up and run the project locally
3. [Setup Guides](./setup/)
   - [VMware Ubuntu Setup](./setup/vmware-ubuntu-setup.md) — Setting up the development VM
   - [k3s Installation](./setup/k3s-installation.md) — Installing the Kubernetes cluster
   - [Tailscale Setup](./setup/tailscale-setup.md) — Configuring VPN access for the team
   - [Argo CD Installation](./setup/argocd-installation.md) — Setting up GitOps deployment

## Quick Start

```bash
# Clone the repository
git clone https://github.com/tiesn/nexus-estate.git
cd nexus-estate/api-gateway

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your local PostgreSQL connection details

# Start the development server
npm run start:dev
```

## Project Structure

```
api-gateway/
├── src/
│   ├── main.ts                    # Application entry point
│   ├── app.module.ts              # Root module
│   ├── database/
│   │   └── type.config.ts         # TypeORM database configuration
│   └── docs/                      # Documentation
│       ├── README.md              # This file
│       ├── ci-cd-pipeline.md      # CI/CD pipeline guide
│       ├── local-development.md   # Local development guide
│       └── setup/                 # Infrastructure setup guides
├── test/
│   ├── app.e2e-spec.ts            # End-to-end tests
│   ├── jest-e2e.json              # E2E test configuration
│   └── integration/
│       └── database.integration-spec.ts  # PostgreSQL integration tests
├── k8s/
│   ├── base/                      # Base Kubernetes manifests
│   ├── overlays/                  # Environment-specific overlays
│   │   ├── production/
│   │   └── staging/
│   └── argocd/                    # Argo CD application manifests
└── Dockerfile                     # Multi-stage Docker build
```

## Architecture

```
┌──────────────┐     ┌────────────────┐     ┌──────────────┐
│   Client     │────▶│  API Gateway   │────▶│  PostgreSQL   │
│  (HTTP/gRPC) │     │  (NestJS)      │     │  (Database)   │
└──────────────┘     └───────┬────────┘     └──────────────┘
                             │
                    ┌────────▼────────┐
                    │  Search Service │
                    │  (Go/grpc)      │
                    └─────────────────┘
```

## Testing

```bash
# Run all unit tests
npm test

# Run unit tests with coverage
npm run test:cov

# Run integration tests (requires Docker)
npm run test:e2e
```

## Building for Production

```bash
# Build TypeScript
npm run build

# Build Docker image
docker build -t nexus-estate-api-gateway .

# Run with Docker Compose (includes PostgreSQL)
docker compose up
```

## Deployment

The service is deployed to a k3s Kubernetes cluster running on a VMware Ubuntu VM, managed by Argo CD for GitOps-based deployments.

For detailed deployment instructions, see:
- [CI/CD Pipeline Documentation](./ci-cd-pipeline.md)
- [Argo CD Installation Guide](./setup/argocd-installation.md)

## Technology Stack

| Component | Technology |
|-----------|-----------|
| Language | TypeScript 5.x |
| Framework | NestJS 11.x |
| ORM | TypeORM 0.3.x |
| Database | PostgreSQL 18 |
| Container Runtime | Node 24 (Alpine) |
| CI/CD | GitHub Actions + Argo CD |
| Container Registry | GitHub Container Registry (GHCR) |
| Kubernetes | k3s |
| VPN | Tailscale |

## Conventional Commits

This project follows [Conventional Commits](https://www.conventionalcommits.org/) for commit messages:

- `feat(scope): description` — New feature
- `fix(scope): description` — Bug fix
- `docs(scope): description` — Documentation
- `test(scope): description` — Tests
- `chore(scope): description` — Maintenance