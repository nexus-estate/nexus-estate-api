import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { BaseRepository } from '../../../../services/abstraction-services';

import { CustomerAccount } from '../entities/customer-account.entity';
import type {
  CustomerAuthenticationAccount,
  SafeCustomerAccount,
  CreatedCustomerAccountIdRow,
  CustomerAccountWithRoleAndPasswordRow,
  CustomerAccountWithRoleRow,
  UpdatedCustomerAccountIdRow,
} from '../types/customer-account.type';

@Injectable()
/** Persistence gateway for customer accounts. */
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
        id: 'compatibility-customer-role',
        name: 'customer',
        description: null,
        isSystem: true,
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

  /** Loads a safe customer projection by identifier. */
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
          u.updated_at AS customer_account_updated_at

        FROM tbl_customer_account u
        WHERE u.id = $1
          AND u.deleted_at IS NULL
        LIMIT 1
      `,
      [id],
    );

    const row = rows[0];

    return row ? this.mapRowToCustomerAccount(row) : null;
  }

  /** Loads a safe customer projection by normalized email. */
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
          u.updated_at AS customer_account_updated_at

        FROM tbl_customer_account u
        WHERE u.email = $1
          AND u.deleted_at IS NULL
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
            u.updated_at AS customer_account_updated_at

          FROM tbl_customer_account u
          WHERE u.email = $1
            AND u.deleted_at IS NULL
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
    roleId?: string;
  }): Promise<SafeCustomerAccount> {
    const query = data.roleId
      ? `
        INSERT INTO tbl_customer_account (
          email,
          password,
          role_id
        )
        VALUES ($1, $2, $3)
        RETURNING id
      `
      : `
        INSERT INTO tbl_customer_account (email, password)
        VALUES ($1, $2)
        RETURNING id
      `;
    const parameters = data.roleId
      ? [data.email, data.password, data.roleId]
      : [data.email, data.password];
    const rows = await this.repository.query<CreatedCustomerAccountIdRow[]>(
      query,
      parameters,
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
}

/** @deprecated Use CustomerAccountRepository in new code. */
