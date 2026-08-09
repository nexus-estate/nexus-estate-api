# api-gateway → shared-contracts Integration

## Status: ✅ Sprint 1 — In Progress

## Why

Currently, `api-gateway` defines DTOs manually in each module (`dto/*.ts`). These values are **not validated** against the OpenAPI specs in `shared-contracts`. This creates a drift risk: if the contract changes, the API may silently break or behave differently than documented.

## Goal

Make `api-gateway` **contract-compliant** — every request/response matches the `shared-contracts/openapi/` specs exactly.

---

## Migration Phases

### Phase 1: Install SDK for Type References (✅ Now — Sprint 1)

1. Add `.npmrc` for GitHub Packages (already done).
2. Install `@nexus-estate/typescript-sdk` to get official types:

   ```bash
   npm install @nexus-estate/typescript-sdk
   ```

3. Use SDK types in services/modules where applicable (e.g., replace manual interfaces with SDK imports).

**What this enables:**
- DTOs can reference SDK types for consistency
- TypeScript catches mismatches between our API and the SDK
- No codegen required yet — just type alignment

### Phase 2: Configure OpenAPI Generator (Sprint 2)

1. Add `@openapitools/openapi-generator-cli` to `devDependencies`.
2. Create `openapitools.json` config:

   ```json
   {
     "$schema": "node_modules/@openapitools/openapi-generator-cli/config/schema.json",
     "generator-cli": {
       "version": "7.12.0",
       "generators": {
         "nestjs-gateway": {
           "generatorName": "typescript-nestjs",
           "inputSpec": "https://raw.githubusercontent.com/tiesn/shared-contracts/main/openapi/public.yaml",
           "output": "./src/generated",
           "additionalProperties": {
             "servicePrefix": "true",
             "provideInjectionTokens": "true",
             "useSingleRequestParameter": "true"
           }
         }
       }
     }
   }
   ```

3. Add script to `package.json`:

   ```json
   "generate:contracts": "openapi-generator-cli generate -g typescript-nestjs -i ../shared-contracts/openapi/public.yaml -o src/generated"
   ```

4. Generate DTOs from OpenAPI spec.
5. Replace manual DTOs with generated ones.

### Phase 3: CI Validation (Sprint 2)

1. Add a CI step to validate contracts:

   ```yaml
   - name: Validate contracts
     run: npm run generate:contracts && git diff --exit-code src/generated/
   ```

2. This ensures PRs that modify DTOs without updating the contracts (or vice versa) are caught.

### Phase 4: Full Contract-First (Sprint 3+)

1. Remove all manual DTOs. Everything comes from codegen.
2. All new features: write the OpenAPI spec first, then codegen, then implement.
3. Use `shared-contracts/mock-server/` for local testing.

---

## Changes Required

### Sprint 1 (This Sprint)

| Task | File | Status |
|------|------|--------|
| Add `.npmrc` | `api-gateway/.npmrc` | ✅ Done |
| Install SDK | Add `@nexus-estate/typescript-sdk` to `package.json` dependencies | ✅ Done |
| LoginDto → LoginRequest | `src/modules/auth/dto/login.dto.ts` | ✅ Done |
| RefreshTokenDto → RefreshTokenRequest | `src/modules/auth/dto/refresh-token.dto.ts` | ✅ Done |
| RegisterUserDto → RegisterRequest | `src/modules/user/dto/create-user-dto.ts` | ✅ Done |
| AuthService typed returns | `src/modules/auth/services/auth.service.ts` | ✅ Done |
| AuthController typed returns | `src/modules/auth/controllers/auth.controller.ts` | ✅ Done |
| User entity implements SdkUser + fullName | `src/modules/user/entities/user.entity.ts` | ✅ Done |
| User service saves fullName | `src/modules/user/services/user.service.ts` | ✅ Done |
| Migration: add full_name column | `src/database/migrations/1741614800000-AddFullNameToUserTable.ts` | ✅ Done |
| Remove duplicate ROLES_REQUIRED/PERMISSIONS_REQUIRED | `src/services/abstraction-services/decorators/` | ✅ Done |
| Update CI | Add `NODE_AUTH_TOKEN` env for `npm ci` | ⏳ Planned |
| Update CI | Add `permissions: packages: write` | ⏳ Planned |

### Sprint 2 (Next)

| Task | Status |
|------|--------|
| Add OpenAPI Generator config | ⏳ Planned |
| Add `generate:contracts` script | ⏳ Planned |
| Generate DTOs from spec | ⏳ Planned |
| Replace manual DTOs | ⏳ Planned |
| Add CI validation step | ⏳ Planned |
| Add `docs/api-contracts.md` | ⏳ Planned |

---

## API Client Structure

After migration, the type flow will be:

```
shared-contracts/openapi/public.yaml
    │
    ├──> @nexus-estate/typescript-sdk (GitHub Packages)
    │     └── Types & interfaces for all API DTOs
    │
    ├──> api-gateway/src/generated/ (OpenAPI Generator)
    │     └── DTOs, controllers, services (auto-generated)
    │
    └──> Manual DTOs (to be removed over time)
```

## Dockerfile

The api-gateway Dockerfile needs `NODE_AUTH_TOKEN` build arg for `npm ci`:

```dockerfile
ARG NODE_AUTH_TOKEN
ENV NODE_AUTH_TOKEN=$NODE_AUTH_TOKEN
COPY package*.json .npmrc ./
RUN npm ci
RUN rm -f .npmrc
```

## CI Updates

Add to `api-gateway/.github/workflows/ci.yml`:

```yaml
permissions:
  contents: read
  packages: write

env:
  NODE_AUTH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

And for Docker build:

```yaml
build-args: |
  NODE_AUTH_TOKEN=${{ secrets.GITHUB_TOKEN }}