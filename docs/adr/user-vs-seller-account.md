# ADR: Buyer account versus SellerAccount ownership

## Decision

`BuyerAccount` is the public buyer authentication identity. `SellerAccount` is
the canonical business identity for supply-side ownership.

Current-account endpoints use the authenticated principal and never accept a
seller ID in the URL or request body:

```text
POST  /api/v1/seller/account
GET   /api/v1/seller/account
PATCH /api/v1/seller/account
```

`owner_buyer_id` is unique and immutable. Seller status and verification status
are server-controlled. Profile updates initially allow only `display_name`.

Future Property and Listing entities should reference `seller_id`; services
should resolve the reusable `CurrentSellerContext` rather than repeatedly
reimplementing BuyerAccount-to-SellerAccount lookup.

## Consequences

- A BuyerAccount can create at most one SellerAccount in the current phase.
- Authentication and seller lifecycle remain separate concerns.
- Suspending a seller can block future supply mutations through
  `SellerAccountPolicy.requireActiveSeller`.
- Organization, teams, KYC, billing, and multi-account ownership remain future
  explicit workflows.
