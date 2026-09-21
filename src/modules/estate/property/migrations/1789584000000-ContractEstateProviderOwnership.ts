import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Contracts provider as the canonical Estate owner.
 *
 * Expand/Verify/Contract flow, self-sufficient for fresh and legacy databases:
 * 1. create the missing provider accounts for estate owners (grandfathered
 *    ACTIVE/VERIFIED, matching the documented
 *    `npm run backfill:provider-account` semantics);
 * 2. restore the active OWNER membership for those accounts so the provider
 *    context resolver keeps working for legacy owners;
 * 3. backfill `fk_provider_id` from the owner binding (idempotent);
 * 4. verify no unresolved estate remains — a remaining row fails the rollout;
 * 5. verify every bound provider target exists;
 * 6. contract `fk_provider_id` as NOT NULL.
 */
export class ContractEstateProviderOwnership1789584000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Grandfather estate owners into provider accounts (idempotent).
    await queryRunner.query(`
      INSERT INTO tbl_provider_account
        (owner_customer_id, type, display_name, status, verification_status)
      SELECT DISTINCT customer.id,
        'INDIVIDUAL',
        COALESCE(NULLIF(split_part(customer.email, '@', 1), ''), customer.email),
        'ACTIVE', 'VERIFIED'
      FROM tbl_estate estate
      INNER JOIN tbl_customer_account customer ON customer.id = estate.fk_customer_id
      WHERE estate.deleted_at IS NULL
        AND customer.deleted_at IS NULL
      ON CONFLICT (owner_customer_id) DO NOTHING
    `);

    // 2. Restore the active OWNER membership so legacy owners resolve a valid
    // provider context instead of being locked out by the membership runtime.
    await queryRunner.query(`
      INSERT INTO tbl_provider_membership (provider_id, customer_id, status)
      SELECT DISTINCT provider.id, provider.owner_customer_id, 'ACTIVE'
      FROM tbl_provider_account provider
      INNER JOIN tbl_estate estate
        ON estate.fk_customer_id = provider.owner_customer_id
      WHERE provider.deleted_at IS NULL AND estate.deleted_at IS NULL
      ON CONFLICT (provider_id, customer_id) DO UPDATE
        SET status = 'ACTIVE', deleted_at = NULL, updated_at = CURRENT_TIMESTAMP
    `);
    await queryRunner.query(
      `
      INSERT INTO tbl_provider_membership_role (membership_id, role_id)
      SELECT DISTINCT membership.id, owner_role.id
      FROM tbl_provider_membership membership
      INNER JOIN tbl_provider_account provider
        ON provider.id = membership.provider_id
        AND provider.owner_customer_id = membership.customer_id
      INNER JOIN tbl_estate estate
        ON estate.fk_customer_id = provider.owner_customer_id
        AND estate.deleted_at IS NULL
      INNER JOIN tbl_provider_role owner_role
        ON owner_role.code = 'OWNER'
        AND owner_role.status = 'ACTIVE'
        AND owner_role.deleted_at IS NULL
      WHERE membership.status = 'ACTIVE' AND membership.deleted_at IS NULL
      ON CONFLICT (membership_id, role_id) DO NOTHING
      `,
    );

    // 3. Backfill estates that predate the provider binding (idempotent).
    await queryRunner.query(`
      UPDATE tbl_estate estate
      SET fk_provider_id = provider.id
      FROM tbl_provider_account provider
      WHERE provider.owner_customer_id = estate.fk_customer_id
        AND provider.deleted_at IS NULL
        AND estate.fk_provider_id IS NULL
    `);

    // 4. Verify no live estate is left without a provider. Fail loudly rather
    // than inventing an owner or silently skipping the constraint.
    const unresolved = (await queryRunner.query(`
      SELECT COUNT(*)::text AS count
      FROM tbl_estate
      WHERE deleted_at IS NULL
        AND fk_provider_id IS NULL
    `)) as { count: string }[];
    if ((unresolved[0]?.count ?? '0') !== '0') {
      throw new Error(
        `Cannot contract Estate provider ownership: ${unresolved[0]?.count} estate(s) have no resolvable provider.`,
      );
    }

    // 5. Verify every bound provider target still exists.
    const dangling = (await queryRunner.query(`
      SELECT COUNT(*)::text AS count
      FROM tbl_estate estate
      LEFT JOIN tbl_provider_account provider
        ON provider.id = estate.fk_provider_id
      WHERE estate.fk_provider_id IS NOT NULL
        AND provider.id IS NULL
    `)) as { count: string }[];
    if ((dangling[0]?.count ?? '0') !== '0') {
      throw new Error(
        `Cannot contract Estate provider ownership: ${dangling[0]?.count} estate(s) reference a missing provider account.`,
      );
    }

    // 6. Contract the canonical ownership column.
    await queryRunner.query(
      `ALTER TABLE tbl_estate ALTER COLUMN fk_provider_id SET NOT NULL`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    // Rollback relaxes the constraint but keeps backfilled provider ids so the
    // previous application version still reads canonical ownership data.
    await queryRunner.query(
      `ALTER TABLE tbl_estate ALTER COLUMN fk_provider_id DROP NOT NULL`,
    );
  }
}
