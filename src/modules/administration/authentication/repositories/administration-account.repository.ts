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
  findByEmailForAuthentication(
    email: string,
  ): Promise<AdministrationAuthenticationAccount | null> {
    return this.findAuthenticationAccount(
      `WHERE a.email = $1 AND a.deleted_at IS NULL`,
      [email],
    );
  }

  /** Finds an administrator by identifier for JWT validation. */
  findByIdForAuthentication(
    id: string,
  ): Promise<AdministrationAuthenticationAccount | null> {
    return this.findAuthenticationAccount(
      `WHERE a.id = $1 AND a.deleted_at IS NULL`,
      [id],
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
