import type { DataSource } from 'typeorm';

/**
 * Creates provider accounts only for customers who already own Estate records.
 *
 * The INSERT is idempotent and deliberately remains a controlled operation;
 * ordinary customers are not silently promoted to providers. Keeping the data
 * source injected makes the transformation independently integration-testable.
 */
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
      'UNVERIFIED'
    FROM tbl_estate e
    INNER JOIN tbl_customer_account u ON u.id = e.fk_customer_id
    WHERE e.deleted_at IS NULL
      AND u.deleted_at IS NULL
    -- Re-running the controlled backfill must not duplicate accounts.
    ON CONFLICT (owner_customer_id) DO NOTHING
    RETURNING id
  `);

  return result.length;
}
