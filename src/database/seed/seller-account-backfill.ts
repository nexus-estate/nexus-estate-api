import dataSource from '../type.config';

/**
 * Creates seller accounts only for users who already own Estate records.
 * The INSERT is idempotent and deliberately remains a controlled operation;
 * ordinary users are not silently promoted to sellers.
 */
export async function backfillSellerAccounts(): Promise<number> {
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
    ON CONFLICT (owner_user_id) DO NOTHING
    RETURNING id
  `);

  return result.length;
}

async function main(): Promise<void> {
  await dataSource.initialize();
  const created = await backfillSellerAccounts();
  console.log(
    `Seller account backfill complete: ${created} account(s) created.`,
  );
  await dataSource.destroy();
}

void main().catch(async (error: unknown) => {
  console.error('Seller account backfill failed.', error);
  if (dataSource.isInitialized) {
    await dataSource.destroy();
  }
  process.exitCode = 1;
});
