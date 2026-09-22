# Nexus Estate API contract inventory

This document is the backend-owned integration reference. Paths below are
relative to `/api/v1`. Successful responses are wrapped by the common response
envelope: `{ status: true, data, timestamp, path }`.

The backend does not currently expose `properties`, `media`, standalone
`search`, `recommendations`, or `payments` routes. Marketplace search is part
of the public Listing collection contract. Frontend clients for absent
capabilities must remain removed or explicitly blocked until implemented.

## Endpoint inventory

| Method | Path                                                                      | Auth realm                      | Provider context         | Request DTO / query                                                | Response data                  |
| ------ | ------------------------------------------------------------------------- | ------------------------------- | ------------------------ | ------------------------------------------------------------------ | ------------------------------ |
| POST   | `/customers/register`                                                     | Public                          | None                     | `RegisterCustomerDto`                                              | Customer auth response         |
| POST   | `/customers/auth/login`                                                   | Public                          | None                     | Customer login DTO                                                 | Token pair                     |
| GET    | `/customers/me`                                                           | Customer JWT                    | None                     | —                                                                  | Customer account response      |
| GET    | `/customers/me/authorization`                                             | Customer JWT                    | None                     | —                                                                  | Customer authorization         |
| POST   | `/customers/auth/refresh`                                                 | Refresh token                   | None                     | Refresh token DTO                                                  | Token pair                     |
| POST   | `/customers/auth/logout`                                                  | Customer JWT                    | None                     | Refresh token DTO                                                  | `void`                         |
| POST   | `/providers/register`                                                     | Public                          | None                     | `RegisterProviderDto` (`email`, `password`, `type`, `displayName`) | Provider registration response |
| POST   | `/providers/register/from-customer`                                       | Customer JWT                    | None                     | `RegisterProviderFromCustomerDto` (`type`, `displayName`)          | Provider registration response |
| GET    | `/providers/me`                                                           | Customer JWT                    | Optional `X-Provider-Id` | —                                                                  | Provider account response      |
| GET    | `/providers/me/authorization`                                             | Customer JWT                    | Optional `X-Provider-Id` | —                                                                  | Provider authorization         |
| POST   | `/provider/account`                                                       | Customer JWT                    | Optional `X-Provider-Id` | `CreateProviderAccountDto`                                         | Provider account response      |
| GET    | `/provider/account`                                                       | Customer JWT                    | Optional `X-Provider-Id` | —                                                                  | Provider account response      |
| PATCH  | `/provider/account`                                                       | Customer JWT                    | Optional `X-Provider-Id` | `UpdateProviderAccountDto`                                         | Provider account response      |
| POST   | `/estates`                                                                | Customer JWT                    | Optional `X-Provider-Id` | `CreateEstateDto`                                                  | Estate response                |
| GET    | `/estates/mine`                                                           | Customer JWT                    | Optional `X-Provider-Id` | —                                                                  | Estate response[]              |
| GET    | `/estates/:id`                                                            | Public                          | None                     | UUID route parameter                                               | Estate response                |
| PATCH  | `/estates/:id`                                                            | Customer JWT                    | Optional `X-Provider-Id` | `UpdateEstateDto`                                                  | Estate response                |
| POST   | `/estates/:id/activate`                                                   | Customer JWT                    | Optional `X-Provider-Id` | UUID route parameter                                               | Estate response                |
| POST   | `/estates/:id/archive`                                                    | Customer JWT                    | Optional `X-Provider-Id` | UUID route parameter                                               | Estate response                |
| POST   | `/estates/:id/restore`                                                    | Customer JWT                    | Optional `X-Provider-Id` | UUID route parameter                                               | Estate response                |
| DELETE | `/estates/:id`                                                            | Customer JWT                    | Optional `X-Provider-Id` | UUID route parameter                                               | `boolean`                      |
| POST   | `/listings`                                                               | Customer JWT                    | Optional `X-Provider-Id` | `CreateListingDto` (`estateId`)                                    | Listing response               |
| GET    | `/listings/mine`                                                          | Customer JWT                    | Optional `X-Provider-Id` | —                                                                  | Listing response[]             |
| GET    | `/listings`                                                               | Public                          | None                     | `ListingQueryDto`                                                  | Paginated published listings   |
| GET    | `/listings/:id`                                                           | Public                          | None                     | UUID route parameter                                               | Published listing response     |
| POST   | `/listings/:id/publish`                                                   | Customer JWT                    | Optional `X-Provider-Id` | UUID route parameter                                               | Listing response               |
| POST   | `/listings/:id/archive`                                                   | Customer JWT                    | Optional `X-Provider-Id` | UUID route parameter                                               | Listing response               |
| POST   | `/listings/:listingId/leads`                                              | Public                          | None                     | `CreateLeadDto`                                                    | Lead response                  |
| GET    | `/locations/provinces`                                                    | Public                          | None                     | —                                                                  | Province[]                     |
| GET    | `/locations/provinces/:provinceId/wards`                                  | Public                          | None                     | UUID route parameter                                               | Ward[]                         |
| POST   | `/administration/auth/login`                                              | Public                          | None                     | Administration login DTO                                           | Token pair                     |
| POST   | `/administration/auth/refresh`                                            | Refresh token                   | None                     | Refresh token DTO                                                  | Token pair                     |
| POST   | `/administration/auth/logout`                                             | Administration JWT              | None                     | Refresh token DTO                                                  | `void`                         |
| GET    | `/administration/me/authorization`                                        | Administration JWT              | None                     | —                                                                  | Administration authorization   |
| GET    | `/administration/provider-registrations`                                  | Administration JWT + permission | None                     | Review filters                                                     | Provider registrations         |
| GET    | `/administration/provider-registrations/:accountId`                       | Administration JWT + permission | None                     | UUID route parameter                                               | Provider registration          |
| POST   | `/administration/provider-registrations/:accountId/approve`               | Administration JWT + permission | None                     | Approval DTO                                                       | Provider registration          |
| GET    | `/administration/providers/:providerId/members`                           | Administration JWT + permission | None                     | Subject filters                                                    | Provider memberships           |
| GET    | `/administration/authorization/platforms`                                 | Administration JWT + permission | None                     | —                                                                  | Authorization platforms        |
| GET    | `/administration/authorization/audit`                                     | Administration JWT + permission | None                     | `AuthorizationAuditQueryDto`                                       | Audit results                  |
| GET    | `/administration/authorization/:platform/roles`                           | Administration JWT + permission | None                     | `AuthorizationRoleListQueryDto`                                    | Paginated roles                |
| POST   | `/administration/authorization/:platform/roles`                           | Administration JWT + permission | None                     | `CreateAuthorizationRoleDto`                                       | Role                           |
| GET    | `/administration/authorization/:platform/roles/:roleId`                   | Administration JWT + permission | None                     | UUID route parameter                                               | Role and permissions           |
| PATCH  | `/administration/authorization/:platform/roles/:roleId`                   | Administration JWT + permission | None                     | `UpdateAuthorizationRoleDto`                                       | Role                           |
| DELETE | `/administration/authorization/:platform/roles/:roleId`                   | Administration JWT + permission | None                     | UUID route parameter                                               | Deleted role                   |
| PUT    | `/administration/authorization/:platform/roles/:roleId/permissions`       | Administration JWT + permission | None                     | `ReplaceRolePermissionsDto`                                        | Role                           |
| GET    | `/administration/authorization/:platform/roles/:roleId/subjects`          | Administration JWT + permission | None                     | `AuthorizationSubjectListQueryDto`                                 | Paginated subjects             |
| GET    | `/administration/authorization/:platform/permissions`                     | Administration JWT + permission | None                     | `AuthorizationPermissionListQueryDto`                              | Paginated permissions          |
| GET    | `/administration/authorization/:platform/permissions/:permissionId`       | Administration JWT + permission | None                     | UUID route parameter                                               | Permission                     |
| GET    | `/administration/authorization/:platform/permissions/:permissionId/roles` | Administration JWT + permission | None                     | UUID route parameter                                               | Permission roles               |
| GET    | `/administration/authorization/:platform/matrix`                          | Administration JWT + permission | None                     | —                                                                  | Authorization matrix           |
| GET    | `/administration/authorization/:platform/subjects`                        | Administration JWT + permission | None                     | `AuthorizationSubjectListQueryDto`                                 | Paginated subjects             |
| GET    | `/administration/authorization/:platform/subjects/:subjectId`             | Administration JWT + permission | None                     | UUID route parameter                                               | Subject authorization          |
| PUT    | `/administration/authorization/:platform/subjects/:subjectId/roles`       | Administration JWT + permission | None                     | `ReplaceSubjectRolesDto`                                           | Subject authorization          |

## Estate wire contract

`CreateEstateDto` accepts only backend enum values and location IDs:

- `type`: `APARTMENT`, `HOUSE`, `VILLA`, `TOWNHOUSE`, `LAND`, `OFFICE`,
  `SHOPHOUSE`, `WAREHOUSE`, `COMMERCIAL`, `HOTEL`, `RESORT`, `FARM`, `OTHER`.
- `purpose`: `SALE`, `RENT`, `SALE_OR_RENT`.
- Required location fields: `provinceId` and `wardId`, both UUIDs.

The API rejects unknown request fields through the global validation pipe. The
customer ID and provider ID are derived from authentication and provider
context; clients must not submit them as ownership fields.

### Estate ownership contract

`fk_provider_id` is the canonical Estate owner and is enforced `NOT NULL` by
the `ContractEstateProviderOwnership1789999894372` migration. Estate
authorization is provider-only: the resolved provider context must match
`estate.providerId`, and the legacy `fk_customer_id` column is provenance-only.

Estate responses use an explicit `EstateResponse` contract that exposes
`id`, `providerId`, `status`, physical attributes, location, and timestamps. It never
exposes `customerId`, the customer/provider relations, `deletedAt`,
`createdBy`, or `updatedBy`.

Property lifecycle status is one of `DRAFT`, `ACTIVE`, or `ARCHIVED`. Creation
always returns `DRAFT`; `PATCH /estates/:id` cannot change status. Commands allow
`DRAFT -> ACTIVE`, `DRAFT -> ARCHIVED`, `ACTIVE -> ARCHIVED`, and
`ARCHIVED -> DRAFT`. Activation validates required publication-quality data,
and a published Listing blocks the archive command. Lifecycle restore only
loads non-deleted rows; it never clears `deleted_at` or resurrects a soft-deleted
Property. `DELETE /estates/:id` remains a separate legacy soft-delete operation.

Public Property visibility requires both `status = ACTIVE` and
`deleted_at IS NULL`. Provider-owned reads can include non-deleted `DRAFT`,
`ACTIVE`, and `ARCHIVED` Properties.

Listing creation accepts only estates owned by the same provider context
(`estate.providerId === context.providerId`) and excludes archived Properties.
It creates a `DRAFT` Listing from a non-deleted `DRAFT` or `ACTIVE` Property.
Publishing requires the Property to be `ACTIVE` and non-deleted; the API returns
`LISTING_PROPERTY_NOT_ACTIVE` with HTTP `409` otherwise. Archived Properties
are excluded from `GET /listings/eligible-properties`. Public Listing reads
also require a published, non-deleted Listing joined to an active, non-deleted
Property.

Property archive, Property DELETE, and Listing publish serialize on the same
Property row using a database pessimistic write lock. This prevents conflicting
commands from succeeding concurrently and preserves the invariant that a
PUBLISHED Listing must reference an ACTIVE, non-deleted Property. The same
serialization boundary protects `DELETE /estates/:id` from racing with Listing
publication; DELETE is still distinct from lifecycle ARCHIVED status.

Lifecycle command endpoints return `200 OK`; create endpoints continue to
return `201 Created`.

The lifecycle migration maps `pending -> DRAFT`, `approved -> ACTIVE`, and
`rejected -> ARCHIVED`, and verifies that no unmapped rows remain. Its `down()`
method is schema-compatible, but it cannot restore historical moderation
semantics after lifecycle writes have reached production; operational recovery
should use a forward fix rather than a database downgrade.

## Feature gates

These capabilities are intentionally not represented by API methods until
their backend domain, DTOs, auth rules, persistence behavior, Swagger contract,
and tests exist:

- Provider lead access and lead-management workflow
- Media upload/finalization
- Recommendations
- Payment orders, callbacks, idempotency, and package activation
