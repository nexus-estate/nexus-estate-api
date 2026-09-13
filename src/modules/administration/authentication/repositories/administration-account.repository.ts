import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

import { BaseRepository } from '../../../../services/abstraction-services';
import { AdministratorAccount } from '../entities/administrator-account.entity';
import type { AdministrationAuthenticationAccount } from '../types/administration-account.type';

/** Reads administrator credentials without depending on the customer account module. */
@Injectable()
export class AdministrationAccountRepository extends BaseRepository<AdministratorAccount> {
  constructor(dataSource: DataSource) {
    super(dataSource, AdministratorAccount, 'AdministratorAccount');
  }

  /** Finds an active or inactive administrator by normalized email. */
  /** Loads one exact administrator email projection with password for login. */
  findByEmailForAuthentication(
    email: string,
  ): Promise<AdministrationAuthenticationAccount | null> {
    return this.findAuthenticationAccount(
      `WHERE a.email = $1 AND a.deleted_at IS NULL`,
      [email],
    );
  }

  /** Finds an administrator by identifier for JWT validation. */
  /** Loads one exact active-check projection for JWT validation and refresh. */
  findByIdForAuthentication(
    id: string,
  ): Promise<AdministrationAuthenticationAccount | null> {
    return this.findAuthenticationAccount(
      `WHERE a.id = $1 AND a.deleted_at IS NULL`,
      [id],
    );
  }

  /** Records the last successful administrator login. */
  /** Records the latest successful administrator login. */
  async updateLastLogin(id: string, lastLogin: Date): Promise<void> {
    await this.dataSource.query(
      `UPDATE tbl_administrator_account
       SET last_login = $2, updated_at = CURRENT_TIMESTAMP
       WHERE id = $1 AND deleted_at IS NULL`,
      [id, lastLogin],
    );
  }

  private async findAuthenticationAccount(
    where: string,
    parameters: readonly string[],
  ): Promise<AdministrationAuthenticationAccount | null> {
    const rows = await this.dataSource.query<AdministrationAccountRow[]>(
      `
        SELECT
          a.id,
          a.email,
          a.password,
          a.is_active AS "isActive",
          a.deleted_at AS "deletedAt"
        FROM tbl_administrator_account a
        ${where}
        LIMIT 1
      `,
      [...parameters],
    );
    const row = rows[0];
    if (!row) {
      return null;
    }

    return {
      id: row.id,
      email: row.email,
      password: row.password,
      isActive: row.isActive,
    };
  }
}

type AdministrationAccountRow = {
  id: string;
  email: string;
  password: string;
  isActive: boolean;
};
