import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Contracts provider as the canonical Estate owner.
 *
 * Expand/Verify/Contract flow, self-sufficient for fresh and legacy databases:
 * 1. create the missing provider accounts for estate owners (grandfathered
 *    ACTIVE/VERIFIED, matching the documented
 *    `npm run backfill:provider-account` semantics);
 * 2. insert the missing owner memberships and OWNER role assignments for those
 *    accounts;
 * 3. backfill `fk_provider_id` from the owner binding (idempotent);
 * 4. verify EVERY estate row — soft-deleted rows included — has a provider; a
 *    remaining row fails the rollout with an explicit error;
 * 5. verify every bound provider target exists;
 * 6. contract `fk_provider_id` as NOT NULL.
 *
 * Lifecycle safety: this migration only ever INSERTS missing compatibility
 * rows and never updates an existing one. A SUSPENDED or REJECTED provider
 * stays suspended/rejected; a SUSPENDED, REMOVED, or soft-deleted membership
 * keeps its authorization state. The migration creates missing compatibility
 * memberships; OWNER is assigned only to memberships created by this
 * migration — existing membership role assignments remain untouched, so an
 * OWNER previously transferred to another membership is never restored. Estate
 * rows are still bound to their provider normally — the runtime denies access
 * for blocked lifecycle states, which is the intended behavior. Re-running the
 * migration is a no-op.
 */
export class ContractEstateProviderOwnership1789584000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Grandfather estate owners into provider accounts (idempotent,
    //    insert-only). Existing accounts keep their status/verification.
    await queryRunner.query(`
      INSERT INTO tbl_provider_account
        (owner_customer_id, type, display_name, status, verification_status)
      SELECT DISTINCT customer.id,
        'INDIVIDUAL',
        COALESCE(NULLIF(split_part(customer.email, '@', 1), ''), customer.email),
        'ACTIVE', 'VERIFIED'
      FROM tbl_estate estate
      INNER JOIN tbl_customer_account customer ON customer.id = estate.fk_customer_id
      WHERE customer.deleted_at IS NULL
      ON CONFLICT (owner_customer_id) DO NOTHING
    `);

    // 2. Ensure every estate-owning provider account has an owner membership.
    //    The CTE captures exactly the memberships inserted by this run, and the
    //    OWNER role is assigned only to those captured rows. An existing
    //    membership is never reactivated, unsuspended, undeleted, or granted
    //    roles — so a transferred OWNER is not restored and authorization is
    //    never changed for memberships that predate the migration.
    await queryRunner.query(`
      WITH inserted_memberships AS (
        INSERT INTO tbl_provider_membership (provider_id, customer_id, status)
        SELECT DISTINCT provider.id, provider.owner_customer_id, 'ACTIVE'
        FROM tbl_provider_account provider
        INNER JOIN tbl_estate estate
          ON estate.fk_customer_id = provider.owner_customer_id
        WHERE provider.deleted_at IS NULL
        ON CONFLICT (provider_id, customer_id) DO NOTHING
        RETURNING id, provider_id, customer_id
      )
      INSERT INTO tbl_provider_membership_role (membership_id, role_id)
      SELECT inserted.id, owner_role.id
      FROM inserted_memberships inserted
      INNER JOIN tbl_provider_account provider
        ON provider.id = inserted.provider_id
        AND provider.owner_customer_id = inserted.customer_id
      INNER JOIN tbl_provider_role owner_role
        ON owner_role.code = 'OWNER'
        AND owner_role.status = 'ACTIVE'
        AND owner_role.deleted_at IS NULL
      ON CONFLICT (membership_id, role_id) DO NOTHING
    `);

    // 3. Backfill estates that predate the provider binding (idempotent).
    //    Soft-deleted estates are backfilled too: the NOT NULL contract below
    //    applies to every row and binding a deleted row cannot re-enable
    //    access to it.
    await queryRunner.query(`
      UPDATE tbl_estate estate
      SET fk_provider_id = provider.id
      FROM tbl_provider_account provider
      WHERE provider.owner_customer_id = estate.fk_customer_id
        AND provider.deleted_at IS NULL
        AND estate.fk_provider_id IS NULL
    `);

    // 4. Verify no estate row at all — soft-deleted included — is left without
    //    a provider. Fail loudly with the offending ids rather than inventing
    //    an owner or letting PostgreSQL fail late with a generic error.
    const unresolvedRows = (await queryRunner.query(
      `SELECT id::text AS id FROM tbl_estate WHERE fk_provider_id IS NULL LIMIT 5`,
    )) as { id: string }[];
    if (unresolvedRows.length > 0) {
      const unresolvedCount = (await queryRunner.query(
        `SELECT COUNT(*)::text AS count FROM tbl_estate WHERE fk_provider_id IS NULL`,
      )) as { count: string }[];
      throw new Error(
        `Cannot contract Estate provider ownership: ${unresolvedCount[0]?.count ?? 'unknown'} estate(s) have no resolvable provider (e.g. ${unresolvedRows
          .map((row) => row.id)
          .join(', ')}). Backfill fk_provider_id before contracting.`,
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
