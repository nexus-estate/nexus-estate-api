# Platform boundaries

The API is organized around business platforms. Authentication identifies a
`CustomerAccount`; supply-side ownership is represented by a `ProviderAccount` in the Provider
Platform.

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

The current phase intentionally assumes one ProviderAccount per CustomerAccount. The
unique `owner_customer_id` constraint makes that invariant database-enforced. If the
product later needs organizations or teams, that should be introduced as an
explicit ownership model rather than turning ProviderAccount into a polymorphic
hierarchy.

Existing Estate owners can be migrated with the controlled, idempotent
`npm run backfill:provider-account` command. It creates only accounts for
distinct non-deleted Estate owners, with `INDIVIDUAL`, `ACTIVE`, and
`UNVERIFIED` defaults. It does not promote every CustomerAccount automatically.
