# Platform boundaries

The API is organized around business platforms. Authentication identifies a
`User`; supply-side ownership is represented by a `SellerAccount` in the Seller
Platform.

```text
User
 └── SellerAccount
      ├── Property
      └── Listing
```

Seller Platform is upstream of Marketplace and ERP operational use cases. It
must not import Marketplace, ERP Internal, Search, or Commerce modules. Future
Property and Listing records should use `seller_id` as their canonical owner,
not `user_id`.

The current phase intentionally assumes one SellerAccount per User. The unique
`owner_user_id` constraint makes that invariant database-enforced. If the
product later needs organizations or teams, that should be introduced as an
explicit ownership model rather than turning SellerAccount into a polymorphic
hierarchy.

Existing Estate owners can be migrated with the controlled, idempotent
`npm run backfill:seller-account` command. It creates only accounts for
distinct non-deleted Estate owners, with `INDIVIDUAL`, `ACTIVE`, and
`UNVERIFIED` defaults. It does not promote every User automatically.
