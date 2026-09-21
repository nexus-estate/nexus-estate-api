# Platform boundaries

The API is organized around business platforms. Authentication identifies a
`CustomerAccount`; supply-side ownership is represented by a `ProviderAccount`
in the Provider Platform.

```text
CustomerAccount
 └── ProviderAccount
      ├── Property
      └── Listing
```

Provider Platform is upstream of Marketplace and ERP operational use cases. It
must not import Marketplace, ERP Internal, Search, or Commerce modules. Future
Property and Listing records should use `provider_id` as their canonical owner,
not `customer_id`.

Estate (Property) rows now enforce that rule at the database level:
`tbl_estate.fk_provider_id` is `NOT NULL` and is the only ownership column used
for authorization. `tbl_estate.fk_customer_id` remains as provenance for rows
created before the provider cutover; it is never read as an owner and never
returned by the Estate API.

The current phase intentionally assumes one ProviderAccount per CustomerAccount.
The unique `owner_customer_id` constraint makes that invariant database-enforced.
A customer keeps the customer authentication identity after provider approval;
provider capability is derived from ProviderAccount state rather than replacing
the customer role.

New provider requests start as `PENDING`. Supply mutation requires the account to
be both `ACTIVE` and `VERIFIED`.

Existing Estate owners are migrated with the controlled, idempotent
`npm run backfill:provider-account` operation before supply gating is enabled.
Legacy providers are grandfathered as verified so an infrastructure rollout does
not unexpectedly lock existing supply owners out of their inventory. Both the
backfill operation and the contract migration only ever insert missing rows:
they never unsuspend a provider, never verify a rejected provider, and never
reactivate or undelete a membership — blocked lifecycle states remain blocked
and the runtime denies access for them.
