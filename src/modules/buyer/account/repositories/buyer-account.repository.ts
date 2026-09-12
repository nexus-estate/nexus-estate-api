import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { BaseRepository } from '../../../../services/abstraction-services';

import { BuyerAccount } from '../models/buyer-account.entity';
import type {
  BuyerAuthenticationAccount,
  SafeBuyerAccount,
  CreatedBuyerAccountIdRow,
  BuyerAccountWithRoleAndPasswordRow,
  BuyerAccountWithRoleRow,
  UpdatedBuyerAccountIdRow,
} from '../types/buyer-account.type';

@Injectable()
/** Persistence gateway for buyer accounts and their RBAC role snapshots. */
export class BuyerAccountRepository extends BaseRepository<BuyerAccount> {
  constructor(dataSource: DataSource) {
    super(dataSource, BuyerAccount, 'BuyerAccount');
  }

  private mapRowToBuyerAccount(row: BuyerAccountWithRoleRow): SafeBuyerAccount {
    return {
      id: row.buyer_account_id,
      email: row.buyer_account_email,
      roleId: row.buyer_account_role_id,
      isEmailVerified: row.buyer_account_is_email_verified,
      lastLogin: row.buyer_account_last_login,
      createdAt: row.buyer_account_created_at,
      updatedAt: row.buyer_account_updated_at,
      role: {
        id: row.role_id,
        name: row.role_name,
        description: row.role_description,
        isSystem: row.role_is_system,
      },
    };
  }

  private mapAuthenticationRowToBuyerAccount(
    row: BuyerAccountWithRoleAndPasswordRow,
  ): BuyerAuthenticationAccount {
    return {
      ...this.mapRowToBuyerAccount(row),
      password: row.buyer_account_password,
    };
  }

  /** Loads a safe buyer projection by identifier, including its role. */
  async findSafeById(id: string): Promise<SafeBuyerAccount | null> {
    const rows = await this.repository.query<BuyerAccountWithRoleRow[]>(
      `
        SELECT
          u.id AS buyer_account_id,
          u.email AS buyer_account_email,
          u.role_id AS buyer_account_role_id,
          u.is_email_verified AS buyer_account_is_email_verified,
          u.last_login AS buyer_account_last_login,
          u.created_at AS buyer_account_created_at,
          u.updated_at AS buyer_account_updated_at,

          r.id AS role_id,
          r.name AS role_name,
          r.description AS role_description,
          r.is_system AS role_is_system
        FROM tbl_buyer_account u
        INNER JOIN tbl_role r
          ON r.id = u.role_id
        WHERE u.id = $1
          AND u.deleted_at IS NULL
          AND r.deleted_at IS NULL
        LIMIT 1
      `,
      [id],
    );

    const row = rows[0];

    return row ? this.mapRowToBuyerAccount(row) : null;
  }

  /** Loads a safe buyer projection by normalized email, including its role. */
  async findByEmail(email: string): Promise<SafeBuyerAccount | null> {
    const rows = await this.repository.query<BuyerAccountWithRoleRow[]>(
      `
        SELECT
          u.id AS buyer_account_id,
          u.email AS buyer_account_email,
          u.role_id AS buyer_account_role_id,
          u.is_email_verified AS buyer_account_is_email_verified,
          u.last_login AS buyer_account_last_login,
          u.created_at AS buyer_account_created_at,
          u.updated_at AS buyer_account_updated_at,

          r.id AS role_id,
          r.name AS role_name,
          r.description AS role_description,
          r.is_system AS role_is_system
        FROM tbl_buyer_account u
        INNER JOIN tbl_role r
          ON r.id = u.role_id
        WHERE u.email = $1
          AND u.deleted_at IS NULL
          AND r.deleted_at IS NULL
        LIMIT 1
      `,
      [email],
    );

    const row = rows[0];

    return row ? this.mapRowToBuyerAccount(row) : null;
  }

  /** Loads the password-bearing projection used only by authentication. */
  async findByEmailForAuthentication(
    email: string,
  ): Promise<BuyerAuthenticationAccount | null> {
    const rows = await this.repository.query<
      BuyerAccountWithRoleAndPasswordRow[]
    >(
      `
          SELECT
            u.id AS buyer_account_id,
            u.email AS buyer_account_email,
            u.password AS buyer_account_password,
            u.role_id AS buyer_account_role_id,
            u.is_email_verified AS buyer_account_is_email_verified,
            u.last_login AS buyer_account_last_login,
            u.created_at AS buyer_account_created_at,
            u.updated_at AS buyer_account_updated_at,

            r.id AS role_id,
            r.name AS role_name,
            r.description AS role_description,
            r.is_system AS role_is_system
          FROM tbl_buyer_account u
          INNER JOIN tbl_role r
            ON r.id = u.role_id
          WHERE u.email = $1
            AND u.deleted_at IS NULL
            AND r.deleted_at IS NULL
          LIMIT 1
        `,
      [email],
    );

    const row = rows[0];

    return row ? this.mapAuthenticationRowToBuyerAccount(row) : null;
  }

  /** Creates an account and returns the safe projection after persistence. */
  async createBuyerAccount(data: {
    email: string;
    password: string;
    roleId: string;
  }): Promise<SafeBuyerAccount> {
    const rows = await this.repository.query<CreatedBuyerAccountIdRow[]>(
      `
        INSERT INTO tbl_buyer_account (
          email,
          password,
          role_id
        )
        VALUES ($1, $2, $3)
        RETURNING id
      `,
      [data.email, data.password, data.roleId],
    );

    const row = rows[0];

    if (!row) {
      throw new Error('BuyerAccount insert did not return a row');
    }

    const buyerAccount = await this.findSafeById(row.id);

    if (!buyerAccount) {
      throw new Error('Created buyer account could not be loaded');
    }

    return buyerAccount;
  }

  /** Updates the last-login timestamp for an active buyer account. */
  async updateLastLogin(buyerId: string, lastLogin: Date): Promise<boolean> {
    const rows = await this.repository.query<UpdatedBuyerAccountIdRow[]>(
      `
        UPDATE tbl_buyer_account
        SET
          last_login = $2,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
          AND deleted_at IS NULL
        RETURNING id
      `,
      [buyerId, lastLogin],
    );
    return rows.length > 0;
  }

  /** Updates a buyer's role and returns whether an active account was changed. */
  /** Changes the RBAC role of an active buyer account. */
  async updateRole(buyerId: string, roleId: string): Promise<boolean> {
    const rows = await this.repository.query<UpdatedBuyerAccountIdRow[]>(
      `
        UPDATE tbl_buyer_account
        SET
          role_id = $2,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
          AND deleted_at IS NULL
        RETURNING id
      `,
      [buyerId, roleId],
    );
    return rows.length > 0;
  }
}
