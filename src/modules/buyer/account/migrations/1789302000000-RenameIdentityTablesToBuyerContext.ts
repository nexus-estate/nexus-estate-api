import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Renames legacy identity references after the API ownership moved to buyer.
 * Historical migrations remain untouched; this forward migration changes only
 * the live schema names used by the current entities and repositories.
 */
export class RenameIdentityTablesToBuyerContext1789302000000 implements MigrationInterface {
  /** Applies the buyer-oriented table and foreign-key names. */
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.renameTable('tbl_user', 'tbl_buyer_account');
    await queryRunner.query(
      'ALTER TABLE tbl_buyer_account RENAME CONSTRAINT fk_user_role TO fk_buyer_account_role',
    );

    await queryRunner.renameColumn(
      'tbl_seller_account',
      'owner_user_id',
      'owner_buyer_id',
    );
    await queryRunner.query(
      'ALTER INDEX uq_seller_account_owner_user_id RENAME TO uq_seller_account_owner_buyer_id',
    );
    await queryRunner.query(
      'ALTER TABLE tbl_seller_account RENAME CONSTRAINT fk_seller_account_owner_user TO fk_seller_account_owner_buyer',
    );

    await queryRunner.renameColumn('tbl_estate', 'fk_user_id', 'fk_buyer_id');
    await queryRunner.query(`
      DO $$
      DECLARE constraint_name text;
      BEGIN
        SELECT conname INTO constraint_name
        FROM pg_constraint
        WHERE conrelid = 'tbl_estate'::regclass
          AND contype = 'f'
          AND pg_get_constraintdef(oid) LIKE '%(fk_buyer_id)%';

        IF constraint_name IS NOT NULL THEN
          EXECUTE format(
            'ALTER TABLE tbl_estate RENAME CONSTRAINT %I TO fk_estate_buyer_id',
            constraint_name
          );
        END IF;
      END $$;
    `);
  }

  /** Restores the legacy names for a controlled rollback. */
  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE tbl_estate RENAME CONSTRAINT fk_estate_buyer_id TO fk_estate_user_id',
    );
    await queryRunner.renameColumn('tbl_estate', 'fk_buyer_id', 'fk_user_id');

    await queryRunner.query(
      'ALTER TABLE tbl_seller_account RENAME CONSTRAINT fk_seller_account_owner_buyer TO fk_seller_account_owner_user',
    );
    await queryRunner.query(
      'ALTER INDEX uq_seller_account_owner_buyer_id RENAME TO uq_seller_account_owner_user_id',
    );
    await queryRunner.renameColumn(
      'tbl_seller_account',
      'owner_buyer_id',
      'owner_user_id',
    );

    await queryRunner.query(
      'ALTER TABLE tbl_buyer_account RENAME CONSTRAINT fk_buyer_account_role TO fk_user_role',
    );
    await queryRunner.renameTable('tbl_buyer_account', 'tbl_user');
  }
}
