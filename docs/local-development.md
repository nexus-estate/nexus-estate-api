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
DB_POSTGRES_PASS=postgres
DB_POSTGRES_NAME=nexus_estate_dev
S3_ENDPOINT=http://localhost:8333
S3_REGION=us-east-1
S3_ACCESS_KEY=local-access-key
S3_SECRET_KEY=local-secret-key
S3_BUCKET=estate-images
```

### Step 5: Start PostgreSQL

#### Option A: Using Docker Compose (Recommended)

```bash
LOCAL_UID=$(id -u) LOCAL_GID=$(id -g) docker compose up --build
```

This starts PostgreSQL, SeaweedFS (S3-compatible media storage), and the API
development container together. Inside the API container, PostgreSQL is reached
as `postgres` and SeaweedFS as `seaweedfs`; Docker Compose overrides those
internal hostnames automatically.

The `seaweedfs-init` one-shot container checks and creates the configured
`S3_BUCKET` before the API starts using the official AWS CLI image, pinned to
version `2.27.49`. All storage commands target SeaweedFS inside the Compose
network. Existing buckets are preserved; a failed create or final bucket check
stops startup. This keeps Media uploads reproducible on a fresh Docker volume.
Check its result with:

```bash
docker compose ps
docker compose logs seaweedfs-init
```

Open the SeaweedFS Filer UI at `http://localhost:8888/buckets/` to browse the
configured `S3_BUCKET`. Estate images are under `<bucket>/estates/<estateId>/`;
click an image filename to view it. Port `8888` is bound to the host loopback
interface for local access. Port `8333` serves the S3 API.

If your host user already has UID/GID 1000:1000, the defaults are sufficient and
you can run `docker compose up --build` directly. Override only when your identity
differs from 1000:1000.

### Step 5a: Recovering from an old node_modules volume

The API container runs `npm ci` on startup so the named `node_modules` volume is
always synchronized with `package-lock.json`. This is required because the
volume hides the `node_modules` directory installed while building the image.

If you previously ran the API and still see a missing dependency or a permission
error, recreate only that volume, not the PostgreSQL data, then rebuild the API
image so dependencies are installed with the configured application UID/GID:

```bash
docker compose down
docker volume rm nexus-estate-api-gateway_nexus_api_node_modules
LOCAL_UID=$(id -u) LOCAL_GID=$(id -g) docker compose up --build -d
```

If the volume name differs, replace it with the exact name reported by
`docker volume ls`. The API startup command no longer runs `npm ci`; dependency
installation is performed by the Docker image build instead.

#### Option B: Using Local PostgreSQL

```bash
sudo apt install postgresql
sudo systemctl start postgresql
sudo -u postgres createdb nexus_estate
sudo -u postgres psql -c "ALTER USER postgres PASSWORD 'nexus';"
```

When running the API outside Docker, keep the host values in `.env`:

```env
DB_POSTGRES_HOST=localhost
S3_ENDPOINT=http://localhost:8333
```

SeaweedFS must still be running locally on port `8333` for Media upload tests.

### Step 6: Start the Development Server

```bash
npm run start:dev
# Server available at: http://localhost:50001
```

## Available Scripts

| Command               | Description                            |
| --------------------- | -------------------------------------- |
| `npm run build`       | Compile TypeScript to JavaScript       |
| `npm run start`       | Start the production server            |
| `npm run start:dev`   | Start in development mode (watch mode) |
| `npm run start:debug` | Start with debugger enabled            |
| `npm run start:prod`  | Start the compiled server              |
| `npm run lint:check`  | Run ESLint without modifying files     |
| `npm run lint:fix`    | Run ESLint and apply fixes             |
| `npm run format`      | Format code with Prettier              |
| `npm test`            | Run unit tests                         |
| `npm run test:cov`    | Run unit tests with coverage           |
| `npm run test:e2e`    | Run integration/e2e tests              |

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
# Generate a module-owned migration (always use the owning module's migrations folder)
npm run typeorm -- migration:create src/modules/provider/property/migrations/CreateProperty
npm run typeorm -- migration:generate src/modules/provider/property/migrations/AddPropertyField

# Run `date +%s%3N` first and use the resulting TypeORM timestamp in the
# filename/class. The folder does not define execution order; the timestamp
# does.

# Run migrations
npx typeorm migration:run

# Run migrations from the compiled production artifact
npm run migration:run:prod
npm run migration:show:prod

# Revert the last migration (only for a deliberate local rollback)
npx typeorm migration:revert
```

## Troubleshooting

| Problem                     | Solution                                                                 |
| --------------------------- | ------------------------------------------------------------------------ |
| `npm install` fails         | Check Node.js version (24.x). Clear npm cache: `npm cache clean --force` |
| Can't connect to PostgreSQL | Ensure PostgreSQL is running. Check credentials in `.env`                |
| Port 50001 in use           | Change the `PORT` in `.env`                                              |
| TypeScript errors           | Run `npm run build` to check compilation                                 |
| Tests fail with Docker      | Ensure Docker is running: `sudo usermod -aG docker \$USER`               |
