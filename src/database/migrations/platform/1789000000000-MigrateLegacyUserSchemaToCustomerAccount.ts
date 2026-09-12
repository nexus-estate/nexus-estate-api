import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Bridges databases that already ran the legacy User/Estate migrations before
 * the CustomerAccount naming model was introduced. Fresh databases already use
 * the new names, so this migration is intentionally a no-op there.
 */
export class MigrateLegacyUserSchemaToCustomerAccount1789000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const hasLegacyUser = await queryRunner.hasTable('tbl_user');
    const hasCustomerAccount = await queryRunner.hasTable(
      'tbl_customer_account',
    );

    if (hasLegacyUser && hasCustomerAccount) {
      throw new Error(
        'Cannot migrate legacy customer schema: tbl_user and tbl_customer_account both exist',
      );
    }

    if (hasLegacyUser) {
      await queryRunner.renameTable('tbl_user', 'tbl_customer_account');
    }

    if (!(await queryRunner.hasTable('tbl_customer_account'))) {
      return;
    }

    const customerTable = await queryRunner.getTable('tbl_customer_account');
    const legacyRoleForeignKey = customerTable?.foreignKeys.find(
      (foreignKey) => foreignKey.name === 'fk_user_role',
    );
    const currentRoleForeignKey = customerTable?.foreignKeys.find(
      (foreignKey) => foreignKey.name === 'fk_customer_account_role',
    );
    if (legacyRoleForeignKey && !currentRoleForeignKey) {
      await queryRunner.query(
        'ALTER TABLE tbl_customer_account RENAME CONSTRAINT "fk_user_role" TO "fk_customer_account_role"',
      );
    }

    if (!(await queryRunner.hasTable('tbl_estate'))) {
      return;
    }

    const estateTable = await queryRunner.getTable('tbl_estate');
    const hasLegacyOwnerColumn = Boolean(
      estateTable?.findColumnByName('fk_user_id'),
    );
    const hasCustomerOwnerColumn = Boolean(
      estateTable?.findColumnByName('fk_customer_id'),
    );

    if (hasLegacyOwnerColumn && hasCustomerOwnerColumn) {
      throw new Error(
        'Cannot migrate legacy estate ownership: fk_user_id and fk_customer_id both exist',
      );
    }

    if (hasLegacyOwnerColumn) {
      await queryRunner.renameColumn(
        'tbl_estate',
        'fk_user_id',
        'fk_customer_id',
      );
    }
  }

  public down(): Promise<void> {
    return Promise.reject(
      new Error(
        'MigrateLegacyUserSchemaToCustomerAccount is forward-only because reverting it could corrupt databases created directly with the CustomerAccount schema',
      ),
    );
  }
}
