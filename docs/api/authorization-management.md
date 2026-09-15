# Authorization Management API

IA-02 exposes a UI-ready authorization management surface for the three independent
platforms in Nexus Estate. All management endpoints are in the Administration
realm; customer and provider realms only expose their own effective authorization
view.

## Platform model

| Platform | Subject | Persistence | Authorization rule |
| --- | --- | --- | --- |
| `MARKETPLACE` | `CUSTOMER` | `tbl_marketplace_*`, `tbl_customer_role_assignment` | Authentication, ownership, and business policy are the baseline. Roles are reserved for differentiated marketplace capabilities. |
| `PROVIDER` | `PROVIDER_MEMBERSHIP` | `tbl_provider_*`, `tbl_provider_membership*` | Membership roles contribute permissions, but supply access also requires an active and verified `ProviderAccount`. |
| `ADMINISTRATION` | `ADMINISTRATOR` | IA-01 `tbl_administration_*` | Active administrator plus current database-backed role permissions. |

Permission definitions are code- and migration-owned. The API can read and search
the catalogue, but has no arbitrary permission-create endpoint. Roles, mappings,
and subject assignments are runtime-managed.

## Management endpoints

All endpoints below require an Administration JWT and the permission shown.

| Method | Path | Permission |
| --- | --- | --- |
| `GET` | `/api/v1/administration/authorization/platforms` | `authorization:platform:read` |
| `GET` | `/api/v1/administration/authorization/:platform/roles` | `authorization:role:read` |
| `POST` | `/api/v1/administration/authorization/:platform/roles` | `authorization:role:write` |
| `GET` | `/api/v1/administration/authorization/:platform/roles/:roleId` | `authorization:role:read` |
| `PATCH` | `/api/v1/administration/authorization/:platform/roles/:roleId` | `authorization:role:write` |
| `DELETE` | `/api/v1/administration/authorization/:platform/roles/:roleId` | `authorization:role:write` |
| `PUT` | `/api/v1/administration/authorization/:platform/roles/:roleId/permissions` | `authorization:role:write` |
| `GET` | `/api/v1/administration/authorization/:platform/roles/:roleId/subjects` | `authorization:assignment:read` |
| `GET` | `/api/v1/administration/authorization/:platform/permissions` | `authorization:permission:read` |
| `GET` | `/api/v1/administration/authorization/:platform/permissions/:permissionId` | `authorization:permission:read` |
| `GET` | `/api/v1/administration/authorization/:platform/permissions/:permissionId/roles` | `authorization:permission:read` |
| `GET` | `/api/v1/administration/authorization/:platform/matrix` | `authorization:role:read` |
| `GET` | `/api/v1/administration/authorization/:platform/subjects` | `authorization:assignment:read` |
| `GET` | `/api/v1/administration/authorization/:platform/subjects/:subjectId` | `authorization:assignment:read` |
| `PUT` | `/api/v1/administration/authorization/:platform/subjects/:subjectId/roles` | `authorization:assignment:write` |
| `GET` | `/api/v1/administration/authorization/audit` | `authorization:audit:read` |
| `GET` | `/api/v1/administration/providers/:providerId/members` | `authorization:assignment:read` |

`:platform` is one of `MARKETPLACE`, `PROVIDER`, or `ADMINISTRATION`.

## Role contract

Role responses include `id`, immutable `code`, `name`, nullable `description`,
`isSystem`, `status`, `version`, `permissionCount`, `assignmentCount`,
`isEditable`, `isDeletable`, `createdAt`, and `updatedAt`.

Role codes use upper snake case and are unique within a platform. System roles
cannot be deleted. Custom roles are soft-deleted and cannot be deleted while they
have assignments. Updates and permission replacement require `expectedVersion`;
a stale version returns HTTP `409` with `AUTHORIZATION_ROLE_VERSION_CONFLICT`.

Create a role with an initial permission set:

```json
{
  "code": "SUPPORT_AGENT",
  "name": "Support Agent",
  "description": "Handles customer support workflows.",
  "permissionIds": []
}
```

Replace a role's complete permission set atomically:

```json
{
  "permissionIds": ["permission-uuid"],
  "expectedVersion": 4
}
```

## Permission contract

Permission responses include `id`, `code`, `name`, `description`, `platform`,
`category`, `resource`, `action`, `riskLevel`, `isAssignable`, `isDeprecated`,
`deprecatedAt`, `createdAt`, and `updatedAt`. Permission filters support `q`,
`category`, `resource`, `action`, `riskLevel`, `isAssignable`, and
`includeDeprecated`.

Cross-platform permissions, unknown permissions, and deprecated/non-assignable
permissions are rejected. Permission catalogue changes must be introduced through
the platform registry and a migration.

## Subjects and effective authorization

Subject assignment uses a normalized read model:

```json
{
  "id": "subject-uuid",
  "subjectType": "PROVIDER_MEMBERSHIP",
  "displayName": "Nexus Realty",
  "secondaryText": "customer@example.com",
  "status": "ACTIVE",
  "roleCount": 1,
  "roleIds": ["role-uuid"]
}
```

`PUT .../subjects/:subjectId/roles` replaces the complete role assignment set in
one transaction. Disabled roles cannot be assigned. The last administration
principal with authorization-management capability and the final active provider
`OWNER` membership are protected.

Provider owner memberships are backfilled idempotently from
`ProviderAccount.owner_customer_id`; that compatibility column remains in IA-02.

Effective views are realm-specific and resolve current database state on request:

- `GET /api/v1/customers/me/authorization`
- `GET /api/v1/providers/me/authorization`
- `GET /api/v1/administration/me/authorization`

JWTs carry identity and realm only. They do not carry the effective permission
set. Provider effective permissions never override provider lifecycle,
verification, ownership, or workflow policies.

## Matrix and pagination

`GET .../:platform/matrix` returns `roles`, permissions grouped by category, and
an `assignments` map from role ID to permission IDs. List endpoints use the common
shape:

```json
{
  "items": [],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 0,
    "totalPages": 0,
    "hasNextPage": false,
    "hasPreviousPage": false
  }
}
```

Sort fields are whitelisted by the service; raw SQL expressions are not accepted.

## Errors and audit

Business errors include `request_id`, `error_code`, `message`, and `details`.
IA-02 stable codes include:

`AUTHORIZATION_PLATFORM_NOT_FOUND`, `AUTHORIZATION_ROLE_NOT_FOUND`,
`AUTHORIZATION_ROLE_CODE_EXISTS`, `AUTHORIZATION_ROLE_IN_USE`,
`AUTHORIZATION_SYSTEM_ROLE_IMMUTABLE`, `AUTHORIZATION_ROLE_VERSION_CONFLICT`,
`AUTHORIZATION_PERMISSION_NOT_FOUND`, `AUTHORIZATION_PERMISSION_NOT_ASSIGNABLE`,
`AUTHORIZATION_PERMISSION_PLATFORM_MISMATCH`, `AUTHORIZATION_SUBJECT_NOT_FOUND`,
`AUTHORIZATION_ROLE_PLATFORM_MISMATCH`, `AUTHORIZATION_LAST_ADMIN_PROTECTION`,
`AUTHORIZATION_ASSIGNMENT_CONFLICT`, and `PROVIDER_LAST_OWNER_PROTECTION`.

Every successful role, mapping, or assignment mutation writes one audit event in
the same transaction. Audit records contain the Administration actor, platform,
action, target, request ID, reason, and authorization-only before/after JSON; they
never contain credentials or tokens.

## UI mapping notes

- Role list columns: name, code, system/custom, status, permission count, assignment count, updated time, and API-provided edit/delete flags.
- Role editor: editable name/description, grouped permissions, risk warnings, and version-aware save.
- Matrix: permission rows grouped by category/resource and role columns, saved using one complete-set `PUT`.
- Subject detail: identity/context, assigned roles, and effective permissions.
- Audit view: filter by platform, actor, action, target, and date range.
