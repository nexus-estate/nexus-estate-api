# Local Development Guide

This guide covers setting up a local development environment for the Nexus Estate API Gateway.

## Prerequisites

- **Node.js**: Version 24.x (use [nvm](https://github.com/nvm-sh/nvm) to manage versions)
- **npm**: Version 10.x (comes with Node.js)
- **PostgreSQL**: Version 18 (local install or Docker)
- **Docker**: For running PostgreSQL and integration tests
- **Git**: For version control

## Quick Setup

### Step 1: Install Node.js

```bash
# Using nvm (recommended)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.0/install.sh | bash
nvm install 24
nvm use 24

# Verify
node --version   # Should be v24.x
npm --version    # Should be 10.x
```

### Step 2: Clone and Install

```bash
git clone https://github.com/tiesn/nexus-estate.git
cd nexus-estate/api-gateway
npm install
```

### Step 3: Configure Environment

```bash
# Copy the example environment file
cp .env.example .env

# Edit .env with your local PostgreSQL connection details
# Default values should work if you're using the docker-compose setup
```

**Default `.env` configuration:**

```env
NODE_ENV=development
PORT=50001
DB_POSTGRES_HOST=localhost
DB_POSTGRES_PORT=5432
DB_POSTGRES_USER=postgres
DB_POSTGRES_PASS=nexus
DB_POSTGRES_NAME=nexus_estate
```

### Step 4: Start PostgreSQL

#### Option A: Using Docker Compose (Recommended)

```bash
docker compose up postgres -d
```

#### Option B: Using Local PostgreSQL

```bash
# On Ubuntu/Debian
sudo apt install postgresql
sudo systemctl start postgresql

# Create the database
sudo -u postgres createdb nexus_estate
sudo -u postgres psql -c "ALTER USER postgres PASSWORD 'nexus';"
```

### Step 5: Start the Development Server

```bash
# Start in watch mode (hot reload)
npm run start:dev

# The server will be available at: http://localhost:50001
```

## Available Scripts

| Command | Description |
|---------|-------------|
| `npm run build` | Compile TypeScript to JavaScript |
| `npm run start` | Start the production server |
| `npm run start:dev` | Start in development mode (watch mode) |
| `npm run start:debug` | Start with debugger enabled |
| `npm run start:prod` | Start the compiled production server |
| `npm run lint` | Run ESLint with auto-fix |
| `npm run format` | Format code with Prettier |
| `npm test` | Run unit tests |
| `npm run test:cov` | Run unit tests with coverage |
| `npm run test:e2e` | Run integration/e2e tests |

## Development Workflow

### 1. Code Quality

Before committing, ensure code quality:

```bash
# Lint and format
npm run lint
npm run format

# Run unit tests
npm test

# Run integration tests (requires Docker)
npm run test:e2e
```

### 2. Adding New Features

1. Create a new branch: `git checkout -b feat/my-feature`
2. Make your changes
3. Write tests for the new functionality
4. Run the full test suite
5. Commit using conventional commits
6. Push and create a PR

### 3. Testing

```bash
# Unit tests (watch mode) — useful during development
npm run test:watch

# Unit tests with coverage
npm run test:cov

# Integration tests (start Postgres testcontainer)
npm run test:e2e

# Debug tests
npm run test:debug
```

### 4. Working with the Database

#### Running Migrations

```bash
# Generate a new migration
npx typeorm migration:create src/database/migrations/MigrationName

# Run migrations
npx typeorm migration:run

# Revert the last migration
npx typeorm migration:revert
```

#### Seeding (if available)

```bash
# Run database seeders
npx ts-node src/database/seeders/run.ts
```

## Debugging

### Using VS Code Debugger

Create a `.vscode/launch.json`:

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Debug NestJS",
      "type": "node",
      "request": "attach",
      "port": 9229,
      "restart": true,
      "skipFiles": ["<node_internals>/**"]
    },
    {
      "name": "Debug Jest Tests",
      "type": "node",
      "request": "launch",
      "runtimeArgs": [
        "--inspect-brk",
        "${workspaceRoot}/node_modules/.bin/jest",
        "--runInBand",
        "--config",
        "${workspaceRoot}/test/jest-e2e.json"
      ],
      "console": "integratedTerminal",
      "internalConsoleOptions": "neverOpen"
    }
  ]
}
```

### Using Chrome DevTools

```bash
# Start the server in debug mode
npm run start:debug

# Open chrome://inspect in Chrome
# Click "Open dedicated DevTools for Node"
```

## Docker Development

### Build and Run Locally

```bash
# Build the Docker image
docker build -t api-gateway:dev .

# Run with Docker Compose (includes PostgreSQL)
docker compose up --build

# Or run standalone with a PostgreSQL instance
docker run -d --name postgres \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=nexus \
  -e POSTGRES_DB=nexus_estate \
  -p 5432:5432 \
  postgres:18-alpine

docker run -d --name api-gateway \
  -p 50001:50001 \
  --link postgres \
  -e DB_POSTGRES_HOST=postgres \
  api-gateway:dev
```

## Troubleshooting

| Problem | Solution |
|---------|----------|
| `npm install` fails | Check Node.js version (24.x). Clear npm cache: `npm cache clean --force` |
| Can't connect to PostgreSQL | Ensure PostgreSQL is running: `docker ps` or `systemctl status postgresql`. Check credentials in `.env` |
| Port 50001 in use | Change the `PORT` in `.env` to another value (e.g., 50002) |
| TypeScript errors | Run `npm run build` to check compilation. Ensure all dependencies are installed |
| ESLint errors | Run `npm run lint -- --fix` to auto-fix issues |
| Tests fail with Docker | Ensure Docker is running and you have permission: `sudo usermod -aG docker $USER` |

## IDE Setup

### VS Code Extensions

Recommended extensions for this project:

- **ESLint** — Linting
- **Prettier** — Code formatting
- **Jest** — Test runner integration
- **NestJS Snippets** — NestJS code snippets
- **Docker** — Docker file support
- **YAML** — YAML support (for k8s manifests)
- **GitLens** — Git integration
- **Tailscale** — Tailscale VPN status

### VS Code Settings

```json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": "explicit"
  },
  "typescript.preferences.importModuleSpecifier": "relative",
  "typescript.updateImportsOnFileMove.enabled": "always",
  "jest.autoRun": "off"
}