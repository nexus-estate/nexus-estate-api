import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';

import { User } from '../entities/user.entity';
import type {
  AuthenticationUser,
  SafeUser,
  CreatedUserIdRow,
  UserWithRoleAndPasswordRow,
  UserWithRoleRow,
  UpdatedUserIdRow,
} from '../types/user.type';

@Injectable()
export class UserRepository {
  constructor(
    @InjectRepository(User)
    private readonly repository: Repository<User>,
  ) {}

  private mapRowToUser(row: UserWithRoleRow): SafeUser {
    return {
      id: row.user_id,
      email: row.user_email,
      roleId: row.user_role_id,
      isEmailVerified: row.user_is_email_verified,
      lastLogin: row.user_last_login,
      createdAt: row.user_created_at,
      updatedAt: row.user_updated_at,
      role: {
        id: row.role_id,
        name: row.role_name,
        description: row.role_description,
        isSystem: row.role_is_system,
      },
    };
  }

  private mapAuthenticationRowToUser(
    row: UserWithRoleAndPasswordRow,
  ): AuthenticationUser {
    return {
      ...this.mapRowToUser(row),
      password: row.user_password,
    };
  }

  async findById(id: string): Promise<SafeUser | null> {
    const rows = await this.repository.query<UserWithRoleRow[]>(
      `
        SELECT
          u.id AS user_id,
          u.email AS user_email,
          u.role_id AS user_role_id,
          u.is_email_verified AS user_is_email_verified,
          u.last_login AS user_last_login,
          u.created_at AS user_created_at,
          u.updated_at AS user_updated_at,

          r.id AS role_id,
          r.name AS role_name,
          r.description AS role_description,
          r.is_system AS role_is_system
        FROM tbl_user u
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

    return row ? this.mapRowToUser(row) : null;
  }

  async findByEmail(email: string): Promise<SafeUser | null> {
    const rows = await this.repository.query<UserWithRoleRow[]>(
      `
        SELECT
          u.id AS user_id,
          u.email AS user_email,
          u.role_id AS user_role_id,
          u.is_email_verified AS user_is_email_verified,
          u.last_login AS user_last_login,
          u.created_at AS user_created_at,
          u.updated_at AS user_updated_at,

          r.id AS role_id,
          r.name AS role_name,
          r.description AS role_description,
          r.is_system AS role_is_system
        FROM tbl_user u
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

    return row ? this.mapRowToUser(row) : null;
  }

  async findByEmailForAuthentication(
    email: string,
  ): Promise<AuthenticationUser | null> {
    const rows = await this.repository.query<UserWithRoleAndPasswordRow[]>(
      `
          SELECT
            u.id AS user_id,
            u.email AS user_email,
            u.password AS user_password,
            u.role_id AS user_role_id,
            u.is_email_verified AS user_is_email_verified,
            u.last_login AS user_last_login,
            u.created_at AS user_created_at,
            u.updated_at AS user_updated_at,

            r.id AS role_id,
            r.name AS role_name,
            r.description AS role_description,
            r.is_system AS role_is_system
          FROM tbl_user u
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

    return row ? this.mapAuthenticationRowToUser(row) : null;
  }

  async create(data: {
    email: string;
    password: string;
    roleId: string;
  }): Promise<SafeUser> {
    const rows = await this.repository.query<CreatedUserIdRow[]>(
      `
        INSERT INTO tbl_user (
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
      throw new Error('User insert did not return a row');
    }

    const user = await this.findById(row.id);

    if (!user) {
      throw new Error('Created user could not be loaded');
    }

    return user;
  }

  async updateLastLogin(userId: string, lastLogin: Date): Promise<boolean> {
    const rows = await this.repository.query<UpdatedUserIdRow[]>(
      `
        UPDATE tbl_user
        SET
          last_login = $2,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
          AND deleted_at IS NULL
        RETURNING id
      `,
      [userId, lastLogin],
    );
    return rows.length > 0;
  }
}
