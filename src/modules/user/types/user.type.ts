export type SafeRole = {
  id: string;
  name: string;
  description: string | null;
  isSystem: boolean;
};

export type SafeUser = {
  id: string;
  email: string;
  roleId: string;
  isEmailVerified: boolean;
  lastLogin: Date | null;
  createdAt: Date;
  updatedAt: Date;
  role: SafeRole;
};

export type AuthenticationUser = SafeUser & {
  password: string;
};
export type CreatedUserIdRow = {
  id: string;
};
export type UserWithRoleRow = {
  user_id: string;
  user_email: string;
  user_role_id: string;
  user_is_email_verified: boolean;
  user_last_login: Date | null;
  user_created_at: Date;
  user_updated_at: Date;

  role_id: string;
  role_name: string;
  role_description: string | null;
  role_is_system: boolean;
};
export type UserWithRoleAndPasswordRow = UserWithRoleRow & {
  user_password: string;
};
export type UpdatedUserIdRow = {
  id: string;
};
