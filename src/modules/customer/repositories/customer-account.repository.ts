import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { BaseRepository } from '../../../services/abstraction-services';

import { CustomerAccount } from '../models/customer-account.entity';
import type {
  CustomerAuthenticationAccount,
  SafeCustomerAccount,
  CreatedCustomerAccountIdRow,
  CustomerAccountWithRoleAndPasswordRow,
  CustomerAccountWithRoleRow,
  UpdatedCustomerAccountIdRow,
} from '../types/customer-account.type';

@Injectable()
/** Persistence gateway for customer accounts and their RBAC role snapshots. */
export class CustomerAccountRepository extends BaseRepository<CustomerAccount> {
  constructor(dataSource: DataSource) {
    super(dataSource, CustomerAccount, 'CustomerAccount');
  }

  private mapRowToCustomerAccount(
    row: CustomerAccountWithRoleRow,
  ): SafeCustomerAccount {
    return {
      id: row.customer_account_id,
      email: row.customer_account_email,
      roleId: row.customer_account_role_id,
      isEmailVerified: row.customer_account_is_email_verified,
      lastLogin: row.customer_account_last_login,
      createdAt: row.customer_account_created_at,
      updatedAt: row.customer_account_updated_at,
      role: {
        id: row.role_id,
        name: row.role_name,
        description: row.role_description,
        isSystem: row.role_is_system,
      },
    };
  }

  private mapAuthenticationRowToCustomerAccount(
    row: CustomerAccountWithRoleAndPasswordRow,
  ): CustomerAuthenticationAccount {
    return {
      ...this.mapRowToCustomerAccount(row),
      password: row.customer_account_password,
    };
  }

  /** Loads a safe customer projection by identifier, including its role. */
  async findSafeById(id: string): Promise<SafeCustomerAccount | null> {
    const rows = await this.repository.query<CustomerAccountWithRoleRow[]>(
      `
        SELECT
          u.id AS customer_account_id,
          u.email AS customer_account_email,
          u.role_id AS customer_account_role_id,
          u.is_email_verified AS customer_account_is_email_verified,
          u.last_login AS customer_account_last_login,
          u.created_at AS customer_account_created_at,
          u.updated_at AS customer_account_updated_at,

          r.id AS role_id,
          r.name AS role_name,
          r.description AS role_description,
          r.is_system AS role_is_system
        FROM tbl_customer_account u
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

    return row ? this.mapRowToCustomerAccount(row) : null;
  }

  /** Loads a safe customer projection by normalized email, including its role. */
  async findByEmail(email: string): Promise<SafeCustomerAccount | null> {
    const rows = await this.repository.query<CustomerAccountWithRoleRow[]>(
      `
        SELECT
          u.id AS customer_account_id,
          u.email AS customer_account_email,
          u.role_id AS customer_account_role_id,
          u.is_email_verified AS customer_account_is_email_verified,
          u.last_login AS customer_account_last_login,
          u.created_at AS customer_account_created_at,
          u.updated_at AS customer_account_updated_at,

          r.id AS role_id,
          r.name AS role_name,
          r.description AS role_description,
          r.is_system AS role_is_system
        FROM tbl_customer_account u
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

    return row ? this.mapRowToCustomerAccount(row) : null;
  }

  /** Loads the password-bearing projection used only by authentication. */
  async findByEmailForAuthentication(
    email: string,
  ): Promise<CustomerAuthenticationAccount | null> {
    const rows = await this.repository.query<
      CustomerAccountWithRoleAndPasswordRow[]
    >(
      `
          SELECT
            u.id AS customer_account_id,
            u.email AS customer_account_email,
            u.password AS customer_account_password,
            u.role_id AS customer_account_role_id,
            u.is_email_verified AS customer_account_is_email_verified,
            u.last_login AS customer_account_last_login,
            u.created_at AS customer_account_created_at,
            u.updated_at AS customer_account_updated_at,

            r.id AS role_id,
            r.name AS role_name,
            r.description AS role_description,
            r.is_system AS role_is_system
          FROM tbl_customer_account u
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

    return row ? this.mapAuthenticationRowToCustomerAccount(row) : null;
  }

  /** Creates an account and returns the safe projection after persistence. */
  async createCustomerAccount(data: {
    email: string;
    password: string;
    roleId: string;
  }): Promise<SafeCustomerAccount> {
    const rows = await this.repository.query<CreatedCustomerAccountIdRow[]>(
      `
        INSERT INTO tbl_customer_account (
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
      throw new Error('CustomerAccount insert did not return a row');
    }

    const customerAccount = await this.findSafeById(row.id);

    if (!customerAccount) {
      throw new Error('Created customer account could not be loaded');
    }

    return customerAccount;
  }

  /** Updates the last-login timestamp for an active customer account. */
  async updateLastLogin(customerId: string, lastLogin: Date): Promise<boolean> {
    const rows = await this.repository.query<UpdatedCustomerAccountIdRow[]>(
      `
        UPDATE tbl_customer_account
        SET
          last_login = $2,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
          AND deleted_at IS NULL
        RETURNING id
      `,
      [customerId, lastLogin],
    );
    return rows.length > 0;
  }

  /** Changes the RBAC role of an active customer account. */
  async updateRole(customerId: string, roleId: string): Promise<boolean> {
    const rows = await this.repository.query<UpdatedCustomerAccountIdRow[]>(
      `
        UPDATE tbl_customer_account
        SET
          role_id = $2,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
          AND deleted_at IS NULL
        RETURNING id
      `,
      [customerId, roleId],
    );
    return rows.length > 0;
  }
}

/** @deprecated Use CustomerAccountRepository in new code. */
