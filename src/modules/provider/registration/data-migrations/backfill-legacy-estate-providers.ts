import type { DataSource } from 'typeorm';

/**
 * Creates provider accounts only for customers who already own Estate records.
 *
 * The INSERT is idempotent and deliberately remains a controlled operation;
 * ordinary customers are not silently promoted to providers. Keeping the data
 * source injected makes the transformation independently integration-testable.
 */
/** Idempotently links legacy estate ownership to provider accounts during controlled backfill. */
export async function backfillLegacyEstateProviders(
  dataSource: DataSource,
): Promise<number> {
  // DISTINCT prevents one provider account per Estate when an owner has many
  // legacy Estate records; the unique owner index is the final guardrail.
  const result = await dataSource.query<{ id: string }[]>(`
    INSERT INTO tbl_provider_account (
      owner_customer_id,
      type,
      display_name,
      status,
      verification_status
    )
    SELECT DISTINCT
      u.id,
      'INDIVIDUAL',
      COALESCE(NULLIF(split_part(u.email, '@', 1), ''), u.email),
      'ACTIVE',
      'VERIFIED'
    FROM tbl_estate e
    INNER JOIN tbl_customer_account u ON u.id = e.fk_customer_id
    WHERE e.deleted_at IS NULL
      AND u.deleted_at IS NULL
    -- Re-running the controlled backfill must not duplicate accounts.
    ON CONFLICT (owner_customer_id) DO NOTHING
    RETURNING id
  `);

  // The provider binding migration adds this column before this command is
  // run. Keep the account creation count stable for operators, then bind all
  // legacy rows through the canonical owner mapping.
  await dataSource.query(`
    UPDATE tbl_estate estate
    SET fk_provider_id = provider.id
    FROM tbl_provider_account provider
    WHERE provider.owner_customer_id = estate.fk_customer_id
      AND provider.deleted_at IS NULL
      AND estate.fk_provider_id IS NULL
  `);

  const unresolved = await dataSource.query<{ count: string }[]>(`
    SELECT COUNT(*)::text AS count
    FROM tbl_estate
    WHERE deleted_at IS NULL AND fk_provider_id IS NULL
  `);
  if (Number(unresolved[0]?.count ?? 0) !== 0) {
    throw new Error(
      `Provider backfill incomplete: ${unresolved[0]?.count ?? 'unknown'} active Estate row(s) remain unbound`,
    );
  }

  return result.length;
}
