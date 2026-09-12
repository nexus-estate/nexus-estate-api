# ADR: Platform-Scoped Identity and Authorization

## Status

Accepted for IA-01. The rollout is split into EXPAND, CODE CUTOVER, and a
separate CONTRACT release.

## Decision

`CustomerAccount` is currently both the public authentication identity and the
marketplace/customer account. This deliberate MVP collapse avoids introducing
`AuthIdentity` before there is a real need for multiple public login providers,
shared public profiles, or a diverging identity lifecycle. The future split is:

```text
AuthIdentity
  └── MarketplaceAccount
```

`ProviderAccount` is a business identity owned by a customer account, not an
authentication role. Provider capability is resolved from the current database
state: `status = ACTIVE` and `verification_status = VERIFIED`. Provider supply
authorization must resolve the current provider context and use its `providerId`;
it must not trust a JWT role claim.

`AdministratorAccount` belongs to a separate internal authentication realm.
Public customer JWTs and administration JWTs remain realm-specific and are not
normalized into one shared credential table.

Roles and permissions are platform-scoped. Administration owns
`AdministrationRole`, `AdministrationPermission`,
`AdministrationRolePermission`, and `AdministratorRoleAssignment`. Internal
endpoint authorization loads current assignments and permissions from the
database so revocation, disabling an administrator, and permission changes take
effect without waiting for token expiry.

The global `CUSTOMER`, `PROVIDER`, and `ADMINISTRATOR` role semantics are
deprecated. The legacy RBAC tables remain physically available during the
rolling-deployment compatibility window, but customer and provider runtime
authorization no longer uses them and administration uses its own scoped model.

## Deferred extension points

Provider memberships and Provider RBAC are intentionally deferred until
organizations or multi-user provider accounts become real requirements:

```text
ProviderMembership(provider_id, customer_or_auth_identity_id, status, joined_at)
  └── ProviderRole / ProviderPermission / membership-role assignment
```

The current `ProviderAccount.owner_customer_id` can then be deprecated through
its own expand-contract migration, with the current owner becoming an OWNER
membership. No membership or provider-role tables are part of IA-01.

## Consequences

- Customer routes use customer authentication, ownership, and business policy;
  they do not need marketplace RBAC merely to establish customer context.
- Provider routes authenticate through the customer realm and resolve
  `ProviderAccount` state from the database.
- Administration routes use explicit administration permission decorators and
  `AdministrationPermissionsGuard`, never the global `RoleService`,
  `RoleGuard`, or `PermissionsGuard`.
- The legacy account `role_id` columns are compatibility fields during Phase B.
  They are nullable after EXPAND and are removed only in a later CONTRACT
  release after dependency and rollback checks pass.
- Generic authorization abstractions such as a universal principal,
  `PlatformRole<T>`, or a policy engine are intentionally not introduced.
  Explicit platform-owned models are preferred until a concrete shared need
  exists.
