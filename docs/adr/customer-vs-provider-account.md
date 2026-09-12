# ADR: Customer account versus ProviderAccount ownership

## Decision

`CustomerAccount` is the public customer authentication identity. `ProviderAccount` is
the canonical business identity for supply-side ownership.

Current-account endpoints use the authenticated principal and never accept a
provider ID in the URL or request body:

```text
POST  /api/v1/provider/account
GET   /api/v1/provider/account
PATCH /api/v1/provider/account
```

`owner_customer_id` is unique and immutable. Provider status and verification status
are server-controlled. Profile updates initially allow only `display_name`.

Future Property and Listing entities should reference `provider_id`; services
should resolve the reusable `CurrentProviderContext` rather than repeatedly
reimplementing CustomerAccount-to-ProviderAccount lookup.

## Consequences

- A CustomerAccount can create at most one ProviderAccount in the current phase.
- Authentication and provider lifecycle remain separate concerns.
- Suspending a provider can block future supply mutations through
  `ProviderAccountPolicy.requireActiveProvider`.
- Organization, teams, KYC, billing, and multi-account ownership remain future
  explicit workflows.
