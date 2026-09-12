export type SafeRole = {
  id: string;
  name: string;
  description: string | null;
  isSystem: boolean;
};

/** Buyer account data safe to expose outside the persistence boundary. */
export type SafeBuyerAccount = {
  id: string;
  email: string;
  roleId: string;
  isEmailVerified: boolean;
  lastLogin: Date | null;
  createdAt: Date;
  updatedAt: Date;
  role: SafeRole;
};

export type BuyerAuthenticationAccount = SafeBuyerAccount & {
  password: string;
};
export type CreatedBuyerAccountIdRow = {
  id: string;
};
export type BuyerAccountWithRoleRow = {
  buyer_account_id: string;
  buyer_account_email: string;
  buyer_account_role_id: string;
  buyer_account_is_email_verified: boolean;
  buyer_account_last_login: Date | null;
  buyer_account_created_at: Date;
  buyer_account_updated_at: Date;

  role_id: string;
  role_name: string;
  role_description: string | null;
  role_is_system: boolean;
};
export type BuyerAccountWithRoleAndPasswordRow = BuyerAccountWithRoleRow & {
  buyer_account_password: string;
};
export type UpdatedBuyerAccountIdRow = {
  id: string;
};
