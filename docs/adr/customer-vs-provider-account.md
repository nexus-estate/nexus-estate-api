# ADR: Customer account versus ProviderAccount ownership

## Decision

`CustomerAccount` is the public authentication identity. `ProviderAccount` is
the canonical business identity for supply-side ownership.

A customer remains a customer after becoming an approved provider. Provider
capability is represented by the owned `ProviderAccount`; approval must not
replace the customer's authentication role.

Current-account endpoints use the authenticated principal and never accept a
provider ID or customer ID from the request body to establish ownership:

```text
POST  /api/v1/provider/account
GET   /api/v1/provider/account
PATCH /api/v1/provider/account
```

`owner_customer_id` is unique and immutable. Provider status and verification
status are server-controlled. New provider accounts enter `PENDING` and may not
mutate supply until an administrator changes them to `VERIFIED`. Profile updates
initially allow only `display_name`.

Future Property and Listing entities should reference `provider_id`; services
should resolve the reusable `CurrentProviderContext` rather than repeatedly
reimplementing CustomerAccount-to-ProviderAccount lookup.

Provider platform writes must not require `ROLES.PROVIDER`. The authenticated
principal remains a `CustomerAccount`; supply capability is resolved through
`CurrentProviderContext` and enforced by `ProviderAccountPolicy`, which
requires `status = ACTIVE` and `verification_status = VERIFIED` before
returning the canonical `providerId` for ownership.

For example, a future Property command should follow this boundary:

```text
authenticated CustomerAccount
  -> ProviderAccountService.requireActiveProvider(customerId)
  -> providerId
  -> Property.provider_id
```

## Consequences

- A CustomerAccount can create at most one ProviderAccount in the current phase.
- Authentication and provider lifecycle remain separate concerns.
- Customer/buyer capabilities remain available after provider approval.
- Supply mutation requires an `ACTIVE` and `VERIFIED` ProviderAccount.
- Suspending a provider blocks supply mutations through
  `ProviderAccountPolicy.requireActiveProvider`.
- Organization, teams, KYC, billing, and multi-account ownership remain future
  explicit workflows.
