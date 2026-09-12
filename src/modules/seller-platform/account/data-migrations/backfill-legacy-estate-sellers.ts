import type { DataSource } from 'typeorm';

/**
 * Creates seller accounts only for users who already own Estate records.
 *
 * The INSERT is idempotent and deliberately remains a controlled operation;
 * ordinary users are not silently promoted to sellers. Keeping the data
 * source injected makes the transformation independently integration-testable.
 */
export async function backfillLegacyEstateSellers(
  dataSource: DataSource,
): Promise<number> {
  // DISTINCT prevents one seller account per Estate when an owner has many
  // legacy Estate records; the unique owner index is the final guardrail.
  const result = await dataSource.query<{ id: string }[]>(`
    INSERT INTO tbl_seller_account (
      owner_user_id,
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
    INNER JOIN tbl_user u ON u.id = e.fk_user_id
    WHERE e.deleted_at IS NULL
      AND u.deleted_at IS NULL
    -- Re-running the controlled backfill must not duplicate accounts.
    ON CONFLICT (owner_user_id) DO NOTHING
    RETURNING id
  `);

  return result.length;
}
