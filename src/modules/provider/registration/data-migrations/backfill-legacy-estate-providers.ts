import type { DataSource } from 'typeorm';

/** Idempotently restores legacy Provider accounts, owner authority, and Estate bindings. */
export async function backfillLegacyEstateProviders(
  dataSource: DataSource,
): Promise<number> {
  const result = await dataSource.query<{ id: string }[]>(`
    INSERT INTO tbl_provider_account
      (owner_customer_id, type, display_name, status, verification_status)
    SELECT DISTINCT u.id, 'INDIVIDUAL',
      COALESCE(NULLIF(split_part(u.email, '@', 1), ''), u.email),
      'ACTIVE', 'VERIFIED'
    FROM tbl_estate e
    INNER JOIN tbl_customer_account u ON u.id = e.fk_customer_id
    WHERE e.deleted_at IS NULL AND u.deleted_at IS NULL
    ON CONFLICT (owner_customer_id) DO NOTHING
    RETURNING id
  `);

  await dataSource.query(`
    UPDATE tbl_provider_account provider
    SET status = 'ACTIVE', verification_status = 'VERIFIED', updated_at = CURRENT_TIMESTAMP
    WHERE provider.deleted_at IS NULL AND EXISTS (
      SELECT 1 FROM tbl_estate estate
      WHERE estate.fk_customer_id = provider.owner_customer_id AND estate.deleted_at IS NULL
    )
  `);
  await dataSource.query(`
    UPDATE tbl_estate estate
    SET fk_provider_id = provider.id
    FROM tbl_provider_account provider
    WHERE provider.owner_customer_id = estate.fk_customer_id
      AND provider.deleted_at IS NULL AND estate.fk_provider_id IS NULL
  `);

  const ownerRoles = await dataSource.query<{ id: string }[]>(`
    SELECT id FROM tbl_provider_role
    WHERE code = 'OWNER' AND status = 'ACTIVE' AND deleted_at IS NULL LIMIT 1
  `);
  const ownerRoleId = ownerRoles[0]?.id;
  if (!ownerRoleId) {
    throw new Error(
      'Provider backfill incomplete: active OWNER role is missing',
    );
  }

  await dataSource.query(`
    INSERT INTO tbl_provider_membership (provider_id, customer_id, status)
    SELECT DISTINCT provider.id, provider.owner_customer_id, 'ACTIVE'
    FROM tbl_provider_account provider
    INNER JOIN tbl_estate estate ON estate.fk_customer_id = provider.owner_customer_id
    WHERE provider.deleted_at IS NULL AND estate.deleted_at IS NULL
    ON CONFLICT (provider_id, customer_id) DO UPDATE
      SET status = 'ACTIVE', deleted_at = NULL, updated_at = CURRENT_TIMESTAMP
  `);
  await dataSource.query(
    `
    INSERT INTO tbl_provider_membership_role (membership_id, role_id)
    SELECT DISTINCT membership.id, $1::uuid
    FROM tbl_provider_membership membership
    INNER JOIN tbl_provider_account provider
      ON provider.id = membership.provider_id AND provider.owner_customer_id = membership.customer_id
    INNER JOIN tbl_estate estate
      ON estate.fk_customer_id = provider.owner_customer_id AND estate.deleted_at IS NULL
    WHERE membership.status = 'ACTIVE' AND membership.deleted_at IS NULL
    ON CONFLICT (membership_id, role_id) DO NOTHING
    `,
    [ownerRoleId],
  );

  const checks = await dataSource.query<
    {
      estate_count: string;
      owner_membership_count: string;
      missing_owner_role_count: string;
    }[]
  >(
    `
    SELECT
      (SELECT COUNT(*) FROM tbl_estate WHERE deleted_at IS NULL AND fk_provider_id IS NULL)::text AS estate_count,
      (SELECT COUNT(*) FROM tbl_provider_account provider
       WHERE provider.deleted_at IS NULL AND EXISTS (SELECT 1 FROM tbl_estate e WHERE e.fk_customer_id = provider.owner_customer_id AND e.deleted_at IS NULL)
       AND (SELECT COUNT(*) FROM tbl_provider_membership m WHERE m.provider_id = provider.id AND m.customer_id = provider.owner_customer_id AND m.status = 'ACTIVE' AND m.deleted_at IS NULL) <> 1)::text AS owner_membership_count,
      (SELECT COUNT(*) FROM tbl_provider_membership m
       INNER JOIN tbl_provider_account provider ON provider.id = m.provider_id AND provider.owner_customer_id = m.customer_id
       INNER JOIN tbl_estate e ON e.fk_customer_id = provider.owner_customer_id AND e.deleted_at IS NULL
       LEFT JOIN tbl_provider_membership_role assignment ON assignment.membership_id = m.id AND assignment.role_id = $1
       WHERE m.status = 'ACTIVE' AND m.deleted_at IS NULL AND assignment.membership_id IS NULL)::text AS missing_owner_role_count
    `,
    [ownerRoleId],
  );
  const check = checks[0];
  if (
    !check ||
    check.estate_count !== '0' ||
    check.owner_membership_count !== '0' ||
    check.missing_owner_role_count !== '0'
  ) {
    throw new Error(
      'Provider backfill incomplete: runtime ownership invariants failed',
    );
  }
  return result.length;
}
