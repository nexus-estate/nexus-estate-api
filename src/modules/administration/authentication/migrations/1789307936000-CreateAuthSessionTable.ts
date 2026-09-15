import { MigrationInterface, QueryRunner } from 'typeorm';

/** Stores only hashed, rotating refresh sessions for both authentication realms. */
export class CreateAuthSessionTable1789307936000 implements MigrationInterface {
  /** Applies this module-owned schema change to the database. */
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE tbl_auth_session (
        session_id uuid PRIMARY KEY,
        account_id uuid NOT NULL,
        realm varchar(32) NOT NULL,
        family_id uuid NOT NULL,
        refresh_token_hash varchar(128) NOT NULL,
        expires_at timestamp NOT NULL,
        absolute_expires_at timestamp NOT NULL,
        created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
        last_used_at timestamp NULL,
        revoked_at timestamp NULL,
        revoke_reason varchar(64) NULL,
        replaced_by_session_id uuid NULL,
        user_agent varchar(512) NULL,
        CONSTRAINT ck_auth_session_realm CHECK (realm IN ('customer', 'administration'))
      )
    `);
    await queryRunner.query(
      `CREATE INDEX idx_auth_session_account_realm ON tbl_auth_session(account_id, realm)`,
    );
    await queryRunner.query(
      `CREATE INDEX idx_auth_session_family ON tbl_auth_session(family_id, realm, account_id)`,
    );
  }

  /** Reverses this module-owned schema change for controlled rollback. */
  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS tbl_auth_session');
  }
}
