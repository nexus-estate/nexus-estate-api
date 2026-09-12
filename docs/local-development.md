# Local Development Guide

This guide covers setting up the local development environment for the
`nexus-estate-api` repository.

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

### Step 2: Clone

```bash
git clone https://github.com/nexus-estate/nexus-estate-api.git
cd nexus-estate-api
```

### Step 3: Install dependencies

Install from the lockfile so local development matches CI:

```bash
npm ci
```

### Step 4: Configure Environment

```bash
cp .env.example .env
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

### Step 5: Start PostgreSQL

#### Option A: Using Docker Compose (Recommended)

```bash
docker compose up --build
```

This starts PostgreSQL and the API development container together.

#### Option B: Using Local PostgreSQL

```bash
sudo apt install postgresql
sudo systemctl start postgresql
sudo -u postgres createdb nexus_estate
sudo -u postgres psql -c "ALTER USER postgres PASSWORD 'nexus';"
```

### Step 6: Start the Development Server

```bash
npm run start:dev
# Server available at: http://localhost:50001
```

## Available Scripts

| Command | Description |
|---------|-------------|
| `npm run build` | Compile TypeScript to JavaScript |
| `npm run start` | Start the production server |
| `npm run start:dev` | Start in development mode (watch mode) |
| `npm run start:debug` | Start with debugger enabled |
| `npm run start:prod` | Start the compiled server |
| `npm run lint:check` | Run ESLint without modifying files |
| `npm run lint:fix` | Run ESLint and apply fixes |
| `npm run format` | Format code with Prettier |
| `npm test` | Run unit tests |
| `npm run test:cov` | Run unit tests with coverage |
| `npm run test:e2e` | Run integration/e2e tests |

## Development Workflow

Husky runs `lint-staged` and `npm run test:all` before each commit. This
covers formatting, linting, build, unit tests, and integration tests.

### 1. Code Quality

```bash
npm run lint:fix
npm run format
npm test
npm run test:e2e
```

### 2. Adding New Features

1. Create a new branch: `git checkout -b feat/my-feature`
2. Make your changes
3. Write tests for the functionality
4. Run the full test suite
5. Commit using conventional commits
6. Push and create a PR

### 3. Working with the Database

```bash
# Generate a new migration
npx typeorm migration:create src/database/migrations/MigrationName

# Run migrations
npx typeorm migration:run

# Revert the last migration
npx typeorm migration:revert
```

## Troubleshooting

| Problem | Solution |
|---------|----------|
| `npm install` fails | Check Node.js version (24.x). Clear npm cache: `npm cache clean --force` |
| Can't connect to PostgreSQL | Ensure PostgreSQL is running. Check credentials in `.env` |
| Port 50001 in use | Change the `PORT` in `.env` |
| TypeScript errors | Run `npm run build` to check compilation |
| Tests fail with Docker | Ensure Docker is running: `sudo usermod -aG docker \$USER` |
