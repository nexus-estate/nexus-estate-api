# Nexus Estate API — Developer and Agent Rules

This is the canonical engineering document for `nexus-estate-api`. Developers,
agents, and reviewers must follow it for every change. A rule in this document
has priority over a local convenience or an older directory pattern.

## 1. Architecture contract

Nexus Estate is a modular NestJS API. Each module is a bounded context and each
feature is a business capability or lifecycle boundary inside that context.
The repository uses feature-based organization, not a module-wide technical
layer organization.

The governing authorization rule is:

> Authentication establishes the principal. Platform context establishes the
> domain. A role grants authority only inside the platform where it is defined.

Customer, Provider, and Administration are separate authorization realms:

- `CustomerAccount` is currently both the public authentication identity and
  the Marketplace account. A customer does not need a `CUSTOMER` role.
- `ProviderAccount` is a business identity. Provider capability is determined
  by membership, ownership, account state, verification, ownership, and
  workflow policy; it is not proven by a `PROVIDER` role.
- `AdministratorAccount` is an internal authentication realm. Its authority
  comes from Administration-scoped role assignments and current database state.
- The legacy global RBAC module is compatibility-only and must not be the
  runtime authorization source for these platforms.

Do not introduce a generic `AuthIdentity`, universal principal, generic role
engine, policy engine, or shared role table prematurely. The future split from
`CustomerAccount` to `AuthIdentity` + `MarketplaceAccount`, and the future
Provider membership evolution, are documented architecture extension points;
they are not reasons to add abstractions now.

## 2. Mandatory feature-based source layout

Every module follows this shape:

```text
src/modules/<module>/
├── <module>.module.ts              # composition root, when the module has one
├── <module>.module.spec.ts
├── <feature-a>/                     # named business feature
│   ├── controllers/                  # HTTP adapters for this feature
│   ├── services/                     # use cases and domain coordination
│   ├── repositories/                 # persistence adapters
│   ├── entities/                     # feature-owned persistence models
│   ├── dto/                          # feature-owned input/output contracts
│   ├── guards/ / strategies/         # feature-owned security adapters
│   ├── helpers/                      # mappers and feature-owned policies
│   ├── errors/ / constants/ / types/
│   ├── *.spec.ts                    # sidecars inside each layer
│   ├── migrations/                  # only when owned by this feature
│   └── data-migrations/             # only for explicit data backfills
└── <feature-b>/
```

The feature directory owns the complete use case: HTTP entry points, DTOs,
domain rules, persistence adapters, errors, and tests. Inside that boundary,
use the normal layer-based folders. For example, a customer account repository
belongs in `customer/account/repositories/`, not in
`customer/repositories/`; its entity belongs in
`customer/account/entities/`.

### 2.1 Current module-to-feature map

| Module | Features and responsibility |
| --- | --- |
| `customer` | `account/` for profile/registration/account persistence; `authentication/` for public login, JWT, and realm guards; `authorization/` for Marketplace role data and effective permissions. |
| `provider` | `account/` for ProviderAccount lifecycle and capability state; `registration/` for provider onboarding and compatibility backfills; `authorization/` for ProviderMembership and Provider-scoped roles/permissions. |
| `administration` | `authentication/` for the internal realm; `provider-review/` for provider approval workflows; `authorization/` for Administration RBAC, management API, audit, and migrations. |
| `estate` | `property/` for the current property/estate supply feature. |
| `location` | `administrative-division/` for province/ward/address data. |
| `lead` | `lead/` for lead persistence and lead behavior. |
| `media` | `asset/` for media persistence and media behavior. |
| `rbac` | `legacy-global/` only for historical global RBAC compatibility and migrations. No new runtime feature may depend on it. |

The feature name answers “which business capability owns this code?” Names such
as `controllers`, `services`, `models`, `entities`, `dto`, `repositories`,
`guards`, `strategies`, `helpers`, `enums`, `types`, `errors`, and `constants`
are technical layers and MUST NOT be direct children of
`src/modules/<module>/`; they belong one level below a named feature.

The feature root may contain only feature composition files and layer
directories. `migrations/` and `data-migrations/` are allowed as lifecycle
directories beneath a feature and must still be owned by it. Do not add
arbitrary generic directories at either level.

### 2.2 What belongs outside a feature

- `src/common/`: cross-cutting NestJS concerns used by multiple bounded
  contexts; it must not become a dumping ground for domain code.
- `src/services/abstraction-services/`: shared persistence/service primitives,
  not business behavior.
- `src/utils/`: genuinely reusable, domain-neutral helpers and constants.
- `src/database/`: database bootstrap and infrastructure-owned seed adapters.

Do not move a feature into `common` merely to avoid choosing an owner.

## 3. Feature ownership and dependency rules

- A module composition file may import its own features and explicitly allowed
  sibling module APIs.
- A feature may import another feature in the same module through its public
  contract, but must not reach into another feature's private implementation
  when a service or exported type exists.
- Customer code must not import Administration authorization.
- Provider code must not import Administration authorization.
- Administration may call Provider application services for review workflows,
  but Administration permissions remain Administration-owned.
- Estate/property uses customer authentication plus
  `ProviderAccountService.requireActiveProvider()` and business ownership
  rules. It must not use `RoleService`, `RoleGuard`, `PermissionsGuard`, or
  `ROLES.PROVIDER`.
- The legacy `rbac/legacy-global` feature may be imported only by compatibility
  code, historical migrations, or explicitly quarantined legacy tests.
- Do not create circular dependencies between feature modules. If a cycle
  appears, move the shared contract to the owning feature's public API or to a
  small domain-neutral common contract.

## 4. Feature file conventions

Put files next to the use case they protect. Examples:

```text
customer/account/
├── controllers/customer.controller.ts
├── dto/customer-account.dto.ts
├── entities/customer-account.entity.ts
├── repositories/customer-account.repository.ts
├── services/customer-account.service.ts
└── *.spec.ts beside each source file

provider/authorization/
├── entities/provider-membership.entity.ts
├── entities/provider-role.entity.ts
├── services/provider-authorization.service.ts
└── *.spec.ts beside each source file

administration/authorization/
├── controllers/authorization-management.controller.ts
├── services/authorization-management.service.ts
├── permissions/administration-permission.registry.ts
├── entities/administration-role.entity.ts
├── entities/authorization-audit-log.entity.ts
└── migrations/
```

Use the feature prefix in public class names and filenames. A filename such as
`service.ts`, `entity.ts`, `common.dto.ts`, or `index.ts` without a clear
feature-specific meaning is not acceptable, except for a deliberately scoped
feature barrel (`index.ts`).

A barrel is allowed only to expose the public contract of its feature. Do not
use barrels to hide cross-feature coupling or recreate a global namespace.

## 5. NestJS composition

The module root is a composition root, not a business implementation folder.
Register controllers, providers, TypeORM entities, guards, and strategies from
their owning feature paths. Keep feature wiring explicit and local.

```typescript
@Module({
  imports: [TypeOrmModule.forFeature([CustomerAccount])],
  controllers: [CustomerController],
  providers: [CustomerAccountRepository, CustomerAccountService],
  exports: [CustomerAccountService],
})
export class CustomerModule {}
```

Do not register a provider in a different feature merely because it is
technically reusable. Export it from the feature that owns its behavior.

## 6. Identity and authorization rules

### 6.1 Realm-specific principals

Customer and Administration JWT strategies remain separate. A customer token
cannot authenticate an Administration endpoint, and an admin token cannot
authenticate a Customer endpoint. JWTs contain identity and realm context, not
long-lived permission snapshots or Provider state.

Customer principal:

```typescript
type CustomerPrincipal = {
  id: string;
  email: string;
  realm: 'customer';
};
```

Administration principal:

```typescript
type AdministrationPrincipal = {
  id: string;
  email: string;
  realm: 'administration';
};
```

Validate account existence, deletion, and allowed status from the database.
Provider status and verification are resolved from the current database state
when a Provider capability is required.

### 6.2 Platform ownership

- Marketplace basic customer behavior is authentication plus ownership and
  business policy. Do not invent a default `CUSTOMER` RBAC role.
- Provider supply mutation requires a valid Provider membership/context, an
  `ACTIVE` membership, an `ACTIVE` ProviderAccount, `VERIFIED` status, and any
  ownership/workflow invariant required by the feature.
- Administration endpoint access requires an active administrator and a
  current Administration permission resolved from role assignments. Permission
  changes and assignment revocation take effect on the next request.
- Platform role and permission tables are independent even when management API
  response shapes are normalized.

Prefer permission checks over role-name checks. Role names such as `SUPER_ADMIN`
must not replace a specific capability permission unless the role identity is
itself the business requirement.

## 7. Database and migration rules

- Entities belong in the feature that owns the table and extend the repository's
  approved base entity where appropriate.
- Repositories belong beside their entity and feature service.
- Table names use `tbl_`; database columns use `snake_case`.
- Every migration has deterministic `up()` and `down()` methods and a colocated
  sidecar test.
- Never rewrite a migration already applied to an environment. Add a new
  migration.
- Feature migrations live in `<feature>/migrations/`; cross-module migrations
  live under `src/database/migrations/platform/`.
- Data backfills live in `<feature>/data-migrations/`, are idempotent, and have
  integration coverage.
- Use expand → cutover → verify → contract for destructive changes. Do not drop
  legacy columns or tables while old application pods can still run.
- Multi-table business mutations and their audit records commit atomically.

The TypeORM configuration must discover migrations recursively below feature
directories. A migration is not runtime seeding: permission catalogues and
known role data are introduced by code-owned registries plus migrations, not by
application startup.

## 8. DTO, API, and error rules

- Validate DTOs at the HTTP boundary: UUIDs, enum values, string lengths,
  bounded arrays, unique array items, and whitelisted sort fields.
- Never accept raw SQL fragments for filtering or sorting.
- Keep response contracts feature-specific and document them with Swagger.
- Use one pagination shape for list endpoints.
- Business failures use the repository's `BusinessException` and a stable,
  feature-owned error code. Include the request ID through the existing error
  response convention.
- Do not expose passwords, tokens, or unnecessary PII in DTOs, logs, or audit
  JSON.

For authorization management, permission definitions are read-only through the
API. Permission codes are code-owned capabilities; roles, role-permission
mappings, and subject-role assignments are runtime-managed. Reject unknown,
cross-platform, deprecated, or non-assignable permissions with stable errors.

## 9. Testing rules — hard requirements

### 9.1 Colocated TypeScript sidecar

Every production `src/**/*.ts` file MUST have exactly one sidecar beside it:
`<name>.spec.ts` or `<name>.test.ts`, never both. Test artifacts are exempt
from recursively requiring another sidecar.

The sidecar must import the file under test and verify its public behavior,
exported contract, metadata, or invariants. An existence-only test is not
enough. Cover normal behavior, invalid input/error behavior, boundary values,
and security/domain invariants applicable to that artifact. This applies to
entities, DTOs, constants, registries, guards, controllers, repositories,
services, migrations, scripts, barrels, and module composition files.

`src/source-sidecar-coverage.spec.ts` is a hard gate. A missing or duplicate
sidecar blocks completion.

### 9.2 Full-flow feature tests

Every business feature and user-visible workflow also needs full-flow coverage
under the existing `test/` directory:

```text
test/<module>/<feature>.spec.ts
```

The spec is the focused home for that feature's end-to-end scenarios. It must
exercise the real application boundary and persistence path appropriate to the
feature (`HTTP/module → guard → controller → service → repository/database`).
Unit mocks do not replace this coverage.

At minimum, include the happy path, invalid input, unauthenticated/forbidden
access, ownership or scope violations, state-transition failures,
duplicate/idempotency behavior, rollback/atomicity, and relevant concurrency or
revocation cases. Every fixed bug gets a regression case in the feature spec.

Existing `test/integration/` suites are retained as a compatibility location
for infrastructure and migration tests. New business flow specs belong in the
module/feature path. Do not create a parallel top-level `tests/` directory.

### 9.3 Test naming and execution

- Colocated unit sidecars use the production basename.
- Full-flow specs use `test/<module>/<feature>.spec.ts`.
- Migration/infrastructure integration specs may use
  `test/integration/**/*.integration-spec.ts`.
- Run the sidecar inventory and relevant unit, integration, and E2E suites
  before reporting completion.
- Never weaken an assertion to make a suite pass; fix the implementation or
  test fixture.

## 10. Import and naming rules

- Prefer the feature's public barrel for the feature contract when one exists.
- Relative imports must point to the owning feature and its layer, never to a
  module-wide technical layer path such as `../services/...` or `../models/...`.
- Use `import type` for type-only imports.
- Keep imports ordered: Node, NestJS, third party, shared abstractions/common,
  sibling features/modules, then local feature files.
- Avoid `any`, `@ts-ignore`, and untyped boundary values.
- Use explicit names: `CustomerAccountService`,
  `ProviderAuthorizationService`, `AdministrationPermissionsGuard`.
- Do not reintroduce `ROLES.CUSTOMER`, `ROLES.PROVIDER`, or
  `ROLES.ADMINISTRATOR` as platform identity semantics.

## 11. Legacy RBAC quarantine

`src/modules/rbac/legacy-global/` is retained only for historical migrations,
rollback compatibility, and explicitly classified legacy code. It must not be
imported by new Customer, Provider, Administration, or Property features.
Before contract removal, audit and eliminate runtime uses of `RoleService`,
`PermissionService`, `RoleGuard`, `PermissionsGuard`, and global role/permission
entities. Do not delete historical migrations just to make the tree look clean.

## 12. Adding or splitting a feature

Before adding a file, answer:

1. Which bounded context owns this behavior?
2. Which named business feature owns the use case?
3. Which feature contract may other modules consume?
4. Which sidecar and `test/<module>/<feature>.spec.ts` protect it?
5. Does the change need a migration, and can it roll through expand/cutover/
   contract safely?

Every feature keeps the normal layer-based folders described in Section 2. If
one feature contains two independent business lifecycles, split it into two
named features. Do not solve growth by adding a module-root `services/`,
`repositories/`, or `utils/` directory.

## 13. Review checklist

- [ ] Code is inside the owning module and named feature.
- [ ] No technical layer directory was added directly under a module.
- [ ] Module root contains only composition files.
- [ ] Cross-feature and cross-module dependencies obey ownership rules.
- [ ] Realm and platform authorization semantics are explicit.
- [ ] New/changed production TypeScript has exactly one colocated sidecar.
- [ ] Full-flow business coverage is in `test/<module>/<feature>.spec.ts`.
- [ ] DTOs, Swagger, errors, and pagination follow existing contracts.
- [ ] Migrations are additive, deterministic, and tested.
- [ ] Legacy RBAC is not used as new runtime authorization.
- [ ] `npm run typecheck`, lint, unit tests, and relevant integration/E2E tests
      pass.
- [ ] No Jobtik repository, service, container, database, or worktree was
      inspected or used for this project.

## 14. Commands

```bash
npm ci
npm run build
npm run typecheck
npm run lint:check
npm test -- --no-coverage
npm run test:e2e -- --no-coverage
npm run migration:verify
docker build --target production .
```

Use the project's configured Nexus Estate PostgreSQL environment for database
tests. If it is unavailable, report that limitation; do not substitute another
repository's database or services.
