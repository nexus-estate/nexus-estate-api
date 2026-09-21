# Nexus Estate API — Agent Instructions

This is the canonical operational instruction file for coding agents working in
`nexus-estate-api`.

Read this file before planning, reviewing, editing, or generating code.

`docs/developer.rules.md` remains the detailed engineering handbook and
architecture rationale. This file contains the execution rules and merge
blockers an agent must follow.

If a future nested `AGENTS.md` exists closer to the file being changed, follow
both files; the nearest file may add stricter feature-specific rules but must
not weaken root invariants.

---

## 1. Mandatory pre-work

Before editing:

1. Identify the bounded context and named business feature that own the change.
2. Inspect neighboring implementation and tests before introducing a new
   pattern.
3. Classify the change:
   - authorization;
   - schema migration;
   - data migration/backfill;
   - API contract;
   - lifecycle/workflow;
   - cross-feature/module dependency.
4. Apply every matching rule below before creating files.
5. Preserve existing user changes. Do not use destructive broad resets.

CI passing does not override an architecture, authorization, ownership, or
migration rule.

Rule meaning:

- **MUST / MUST NOT**: merge blocker.
- **SHOULD / SHOULD NOT**: expected default; deviation requires a concrete
  repository-specific reason.

---

## 2. Core architecture rules

### ARCH-001 — Feature ownership

Every business file MUST belong to a named feature inside its bounded context.

Valid:

```text
src/modules/provider/account/services/...
src/modules/provider/authorization/services/...
src/modules/estate/property/repositories/...
```

Invalid:

```text
src/modules/provider/services/...
src/modules/provider/repositories/...
src/modules/estate/controllers/...
```

`src/modules/<module>/` is a bounded-context composition root. Direct children
must be named business features or module composition files.

MUST NOT create module-root technical layers such as:

```text
controllers/
services/
repositories/
models/
entities/
dto/
guards/
strategies/
helpers/
enums/
types/
errors/
constants/
permissions/
```

Inside a named feature, normal layer folders are allowed.

### ARCH-002 — Shared directories are not domain dumping grounds

Use:

- `src/common/` only for genuinely cross-cutting NestJS concerns;
- `src/services/abstraction-services/` only for shared primitives;
- `src/utils/` only for domain-neutral helpers;
- `src/database/` for database bootstrap/infrastructure concerns.

Do not move domain behavior into shared folders merely to avoid choosing an
owner.

### ARCH-003 — Avoid empty abstraction layers

Do not add a service, resolver, facade, mapper, policy, wrapper, or scope layer
that only passes arguments through and owns no invariant, policy, translation,
or stable boundary.

Before adding an abstraction, answer:

1. What invariant does it own?
2. What duplication/coupling does it remove?
3. Is there a real second consumer?
4. Does it make the business boundary clearer?

If not, prefer the simpler concrete implementation.

### ARCH-004 — No circular dependencies

Do not create circular feature/module dependencies.

If a cycle appears, move the shared contract to the true owning feature's
public API or, only when genuinely domain-neutral, to a small shared contract.

Do not hide cycles behind barrels or forwarding wrappers.

---

## 3. Current bounded-context ownership

| Module | Feature | Responsibility |
| --- | --- | --- |
| `customer` | `account` | Customer profile, registration, persistence |
| `customer` | `authentication` | Public login, JWT, Customer realm guards |
| `customer` | `authorization` | Marketplace authorization data |
| `provider` | `account` | ProviderAccount lifecycle and Provider context |
| `provider` | `registration` | Provider onboarding and compatibility backfills |
| `provider` | `authorization` | ProviderMembership, Provider roles/permissions |
| `administration` | `authentication` | Internal Administration realm |
| `administration` | `provider-review` | Provider approval workflow |
| `administration` | `authorization` | Administration RBAC, management, audit |
| `estate` | `property` | Property/Estate supply persistence and behavior |
| `location` | `administrative-division` | Province/Ward/address data |
| `lead` | `lead` | Lead persistence and behavior |
| `media` | `asset` | Media persistence and behavior |
| `rbac` | `legacy-global` | Historical compatibility only |

---

## 4. Authorization and ownership invariants

### AUTH-001 — Realm separation

Authentication establishes identity. Platform context establishes the domain.
Authority is valid only inside the platform that owns it.

Customer, Provider, and Administration are separate authorization realms.

MUST NOT:

- use a Customer token as Administration authority;
- use an Administration token as Customer authority;
- use a global role as proof of Provider capability;
- reintroduce `ROLES.CUSTOMER`, `ROLES.PROVIDER`, or
  `ROLES.ADMINISTRATOR` as platform identity semantics.

Current database state is authoritative for account status and permissions.

### AUTH-002 — Provider is the canonical supply owner

```text
CustomerAccount = authenticated actor / Marketplace identity
ProviderAccount = canonical supply-side business identity
ProviderMembership = Customer access to a Provider
Estate.providerId = canonical Property ownership
Estate.customerId = compatibility/provenance only
```

Provider supply authorization MUST resolve Provider context and compare
Provider ownership.

Forbidden:

```ts
estate.customerId === currentCustomerId
```

Required direction:

```ts
const context = await providerContextResolver.resolve(...);

estate.providerId === context.providerId
```

The server validates Provider context. `X-Provider-Id` selects a candidate
context; it never grants authority by itself.

Do not manually thread Provider IDs through every layer when the existing
Provider context boundary already owns that responsibility.

### AUTH-003 — Provider runtime requirements

Provider supply mutation requires the relevant combination of:

```text
ProviderMembership ACTIVE
ProviderAccount ACTIVE
verification VERIFIED
required Provider permission/role when applicable
resource owned by resolved Provider
valid workflow state
```

Use `ProviderContextResolver` for context selection.

Estate/property MUST NOT introduce dependencies on legacy `RoleService`,
`RoleGuard`, `PermissionsGuard`, or `ROLES.PROVIDER`.

### AUTH-004 — Administration permissions

Administration endpoint access requires current Administration authentication,
active administrator state, and current DB-backed Administration permission.

Permission revocation must take effect on subsequent requests.

Prefer permission checks over role-name checks unless the role identity itself
is the business requirement.

### AUTH-005 — Legacy RBAC quarantine

`src/modules/rbac/legacy-global/` is compatibility-only.

New Customer, Provider, Administration, or Property runtime code MUST NOT
depend on it.

Historical migrations, rollback compatibility, explicitly quarantined legacy
code, and legacy tests may reference it.

---

## 5. Database and migration rules

### MIG-001 — Migration timestamp — BLOCKER

Before creating a TypeORM migration, MUST run:

```bash
date +%s%3N
```

Use the exact returned 13-digit Unix-millisecond value.

Required identity:

```text
<timestamp>-<Description>.ts
```

and:

```ts
export class <Description><timestamp> implements MigrationInterface
```

MUST NOT:

- invent a timestamp;
- round a timestamp;
- choose a memorable timestamp/date;
- derive one from a release date;
- copy an existing timestamp and increment it manually;
- use relative numbers such as `001`, `002`;
- rely on directory order.

The timestamp is the actual migration creation identity, not an approximate
business date.

### MIG-002 — Migration ownership

Every new schema migration MUST live under:

```text
src/modules/<module>/<feature>/migrations/
```

The owning feature is the feature whose persistence contract changes.

`src/database/migrations/` is not a valid location for new schema migrations.

Cross-module changes still require one explicit owning feature.

### MIG-003 — Append-only deployed history

Once a migration has reached a shared or deployed environment, MUST NOT edit,
rename, reorder, or reuse its identity.

Add a new migration instead.

An unshared feature-branch migration may be corrected before merge, but
filename, class name, imports, tests, docs, and discovery references MUST be
updated together.

### MIG-004 — Schema migration vs data migration

Schema changes belong in:

```text
<feature>/migrations/
```

Business-data transformations/backfills belong in:

```text
<feature>/data-migrations/
```

Data migrations SHOULD be idempotent when operationally practical and MUST
have integration coverage for important invariants.

Seeds are only for reference/bootstrap data.

### MIG-005 — Destructive changes

Use:

```text
expand -> backfill/cutover -> verify -> contract -> cleanup
```

Do not drop legacy columns/tables while an older application version may still
run.

Contract migrations MUST verify prerequisites before tightening constraints.

### MIG-006 — Deterministic migration behavior

Every migration MUST:

- have deliberate deterministic `up()`;
- have deliberate `down()` behavior appropriate to rollback;
- use TypeORM `QueryRunner` and migration-local SQL/metadata;
- avoid imports from application services;
- preserve valid existing lifecycle/authorization state unless changing it is
  the explicit migration purpose.

Folder hierarchy does not control order. TypeORM's migration timestamp does.

New timestamps MUST be globally unique. Do not add an allowlist entry merely to
make a new collision pass.

### MIG-007 — Mandatory verification

For every schema migration change, MUST run:

```bash
npm run migration:check-timestamps
npm run migration:verify
```

Also run the relevant migration/integration test suite.

If the configured Nexus Estate PostgreSQL/Docker environment is unavailable,
report that limitation. Never substitute another project's database.

---

## 6. API, DTO, and error rules

### API-001 — Validate boundaries

DTOs MUST validate applicable:

- UUIDs;
- enum values;
- string lengths;
- numeric bounds;
- array bounds;
- uniqueness;
- whitelisted sort/filter fields.

Never accept raw SQL fragments from API input.

### API-002 — Explicit wire contracts

Use feature-specific response contracts and keep Swagger aligned with actual
responses.

Do not accidentally expose persistence entities when they contain internal or
legacy fields.

Do not expose passwords, tokens, unnecessary PII, or internal ownership/audit
fields unless intentionally part of the API contract.

### API-003 — Server-derived ownership

Ownership derived from authentication or Provider context MUST NOT be accepted
from request bodies merely for convenience.

The client may select Provider context only through the supported context
mechanism; the server validates it.

### ERR-001 — Localized stable business errors

Business failures use `BusinessException` and stable feature-owned error codes.

Every business error definition MUST expose:

```ts
messages: {
  en: ...,
  vi: ...,
}
```

Message values come from the owning feature's catalogue, normally
`messages.json`.

Do not silently duplicate one language into the other.

---

## 7. Testing rules

### TEST-001 — Test behavior and risk, not file presence

There is no repository-wide requirement that every production TypeScript file
must have a colocated test sidecar.

Do not create tests whose only purpose is:

```text
"module loads"
"export exists"
"file can be imported"
```

Behavior-bearing services, policies, guards, strategies, repositories with
custom queries, authorization evaluators, migration helpers, logic-bearing
mappers, middleware/interceptors, and critical controllers normally need
focused behavioral coverage.

Pure interfaces/types, simple DTO declarations, enums, constants, barrels,
simple entities, and wiring-only files may be covered indirectly when they
contain no meaningful behavior.

### TEST-002 — Required behavior coverage

Cover the relevant combination of:

- happy path;
- invalid input;
- unauthenticated/forbidden behavior;
- ownership/scope violations;
- lifecycle/state failures;
- duplicate/idempotency behavior;
- rollback/atomicity;
- concurrency/revocation when relevant.

Never weaken an assertion merely to make CI pass.

### TEST-003 — Full-flow business coverage

Critical user-visible workflows SHOULD have full-flow coverage under:

```text
test/<module>/<feature>.spec.ts
```

Exercise the real boundary appropriate to the feature:

```text
HTTP/module
  -> guard
  -> controller
  -> service/policy
  -> repository
  -> database
```

Unit mocks do not replace full-flow coverage for critical behavior.

Existing migration/infrastructure integration tests may remain under:

```text
test/integration/
```

Do not create a parallel top-level `tests/` directory.

### TEST-004 — Regression rule

Every fixed bug MUST get a regression test at the narrowest level that would
have caught it, plus full-flow coverage when the bug affected an external
workflow.

Examples:

```text
authorization bug -> focused auth test + endpoint flow when relevant
migration bug -> migration integration test
ownership leak -> cross-provider full-flow test
response-shape bug -> HTTP contract test
```

---

## 8. TypeScript, dependency, and naming rules

Use `import type` for type-only imports.

Avoid:

- `any`;
- `@ts-ignore`;
- untyped boundary values.

Prefer feature public contracts where available.

Do not use stale module-wide paths such as `../services/...`,
`../models/...`, or `../controllers/...` when the target belongs to a named
feature.

Use explicit business names, for example:

```text
CustomerAccountService
ProviderAuthorizationService
ProviderContextResolver
AdministrationPermissionsGuard
```

Avoid ambiguous production filenames such as `service.ts`, `entity.ts`,
`common.dto.ts`, or `utils.ts` unless the surrounding feature makes the
intent unambiguous.

Feature-local barrels are allowed only as deliberate public contracts.

---

## 9. Documentation rule

Comments and JSDoc explain behavior, intent, invariants, side effects, or safe
usage. Do not restate syntax.

Behavior-bearing public services/classes and non-obvious public methods SHOULD
document relevant authorization, transaction, persistence, lifecycle, or
context-selection behavior.

Keep documentation truthful when behavior changes.

---

## 10. Change-specific checklist

### Schema migration

Before implementation:

- [ ] identify owning feature;
- [ ] inspect neighboring migrations;
- [ ] run `date +%s%3N`;
- [ ] use the exact timestamp in filename/class;
- [ ] decide schema migration vs data migration;
- [ ] define rollback;
- [ ] define migration integration coverage.

Before completion:

- [ ] timestamp is globally unique;
- [ ] no deployed history was rewritten;
- [ ] migration owner/path is correct;
- [ ] no application service import;
- [ ] expand/backfill/verify/contract ordering is safe;
- [ ] `npm run migration:check-timestamps` passed;
- [ ] `npm run migration:verify` passed;
- [ ] relevant migration integration tests passed.

### Authorization

Before implementation, write down:

```text
principal
platform
resolved context
resource owner
required lifecycle state
required permission/role if any
server-side invariant
```

Before completion:

- [ ] realm separation preserved;
- [ ] server remains authoritative;
- [ ] client input does not grant authority;
- [ ] cross-provider/cross-realm denial tested;
- [ ] current DB state/revocation behavior preserved;
- [ ] legacy global RBAC not reintroduced.

### API contract

Before completion:

- [ ] DTO validation explicit;
- [ ] response contract explicit;
- [ ] Swagger matches actual response;
- [ ] ownership/internal fields not accepted or leaked incorrectly;
- [ ] stable error codes/localization preserved;
- [ ] HTTP/full-flow tests cover changed contract.

### Lifecycle/workflow

Prefer explicit commands/transitions over arbitrary status patches.

Define:

```text
allowed source state
command
target state
actor/context
authorization
side effects
idempotency
invalid transition behavior
```

Test invalid transitions as well as happy paths.

---

## 11. Patterns agents MUST NOT introduce

```text
module-root services/repositories/controllers directories
generic AuthIdentity without a current use case
universal role/policy engine
shared cross-platform role table
global Provider role identity
Provider ownership authorization through customerId
manual migration timestamps
relative migration sequence numbers
runtime startup data migration
empty pass-through abstraction layers
circular dependencies hidden by barrels
trivial file-existence/export-existence tests
weakened assertions to satisfy CI
raw SQL sort/filter input
destructive broad reset of user work
```

---

## 12. Project isolation

All work is scoped to Nexus Estate.

MUST NOT inspect, use, modify, connect to, or borrow infrastructure from any
Jobtik repository, service, container, database, or worktree.

If required Nexus Estate infrastructure is unavailable, report the limitation.

---

## 13. Verification gates

For a substantial PR, default to:

```bash
npm ci
npm run build
npm run typecheck
npm run lint:check
npm test -- --no-coverage
npm run test:e2e -- --no-coverage
npm run migration:check-timestamps
npm run migration:verify
docker build --target production .
```

Only run migration gates when relevant if the task is small and contains no
schema change; they are mandatory for schema changes.

Never claim a command passed unless it actually ran.

If infrastructure prevents a required command, report the exact command and
reason.

---

## 14. Review priority

When tradeoffs exist, use this order:

```text
1. domain invariant
2. ownership boundary
3. authorization
4. API/data contract
5. migration/deployment safety
6. maintainability
7. observability
8. scale
9. optional abstraction
```

Do not trade a higher-priority invariant for a lower-priority convenience.

---

## 15. Completion report

Before declaring completion, report:

```text
Changed files:
- ...

Behavior/invariants changed:
- ...

Migrations:
- timestamp:
- owning feature:
- schema vs data:
- rollback:
- verification:

Tests/commands run:
- ...

Commands not run:
- ...

Remaining risks/follow-up:
- ...
```

Do not report completion while a required check is pending or known to fail.

For deeper architecture rationale and historical context, consult
`docs/developer.rules.md`.
