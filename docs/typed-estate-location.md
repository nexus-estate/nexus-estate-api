# Typed estate locations

Estate and Listing responses expose `urbanWardId` (phường), `communeId`
(xã), and `specialZoneId` (đặc khu). Exactly one is populated for a valid
address. The deprecated `wardId` remains the canonical all-types identifier
for existing clients and older application instances.

## API contract

New clients send `provinceId` and one typed unit ID when creating an estate.
The unit must exist, belong to the province, and match the selected type.
The following public endpoints supply province-scoped pickers:

```text
GET /api/v1/locations/provinces/:provinceId/urban-wards
GET /api/v1/locations/provinces/:provinceId/communes
GET /api/v1/locations/provinces/:provinceId/special-zones
```

Each picker entry contains only `id`, `code`, `name`, `type`, and `provinceId`.
Province and unit IDs are UUIDs. Existing `/wards` behavior remains available.

For example, a new estate can select an xã with:

```json
{
  "provinceId": "10000000-0000-4000-8000-000000000001",
  "communeId": "20000000-0000-4000-8000-000000000002"
}
```

This fragment accompanies the other required estate fields. During an update,
selecting a new typed unit replaces the previous type; unrelated updates retain
the current address. Clearing all selections without choosing a unit is invalid.
The legacy `wardId` input still accepts any supported unit type. If both legacy
and typed IDs are supplied, they must match. Invalid selections use the localized
`PROPERTY_INVALID_LOCATION_SELECTION` error; missing reference data uses the
existing not-found errors.

Authentication, Provider context, ownership, and property permissions remain
server-validated. The new location fields grant no authority.

## Deployment and backfill

The existing migration `ExpandTypedEstateLocation1793864140180` belongs to
`estate/property/migrations/`. It adds nullable typed columns, foreign keys,
indexes, and synchronization triggers while retaining `fk_ward_id`. Its check
constraint starts as `NOT VALID` so existing rows can be backfilled separately.
New writes are checked immediately; older writers using only `wardId` are
synchronized by the trigger.

Apply the schema before deploying application code that reads the new columns:

```bash
npm run migration:run
npm run backfill:estate-location
```

For compiled artifacts, use `migration:run:prod` and
`backfill:estate-location:prod`. The explicit backfill lives in
`estate/property/data-migrations/`; it never runs at application startup.
It fills missing typed selections and validates the check constraint in one
transaction. It is idempotent and preserves canonical address IDs, Provider
ownership, and lifecycle state. Invalid historical addresses abort the entire
transaction and must be corrected before retrying.

The API derives typed response IDs from the canonical hydrated unit, including
rows awaiting backfill. Once referenced, a unit's type and province cannot be
changed while estates still reference it.

For rollback, restore an application version that uses the legacy columns
before reverting the schema migration in reverse migration order. Its `down()`
removes only the added typed columns, constraints, indexes, functions, and
triggers; canonical address IDs remain intact.
