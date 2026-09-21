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
should resolve the reusable `ProviderContextResolver` rather than repeatedly
reimplementing CustomerAccount-to-ProviderAccount lookup.

Estate (Property) ownership is contracted as of
`ContractEstateProviderOwnership1789584000000`:

```text
fk_provider_id = canonical ownership (NOT NULL)
fk_customer_id = compatibility/provenance only
```

Estate services never authorize through `fk_customer_id`. Supply commands
resolve the provider context from the authenticated customer and assert
`estate.providerId === context.providerId`; the legacy customer column is kept
only for provenance and must not be exposed in API responses.

Provider platform writes must not require `ROLES.PROVIDER`. The authenticated
principal remains a `CustomerAccount`; supply capability is resolved through
`ProviderContextResolver` and enforced by `ProviderAccountPolicy` (active and
verified) plus `ProviderSupplyAccessPolicy` (supply write/read access).

For example, a future Property command should follow this boundary:

```text
authenticated CustomerAccount
  -> ProviderContextResolver.resolve(customerId)
  -> ProviderSupplyAccessPolicy.requireWriteAccess(context)
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
