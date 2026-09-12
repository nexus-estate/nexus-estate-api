export type SafeRole = {
  id: string;
  name: string;
  description: string | null;
  isSystem: boolean;
};

/** Customer account data safe to expose outside the persistence boundary. */
export type SafeCustomerAccount = {
  id: string;
  email: string;
  roleId: string;
  isEmailVerified: boolean;
  lastLogin: Date | null;
  createdAt: Date;
  updatedAt: Date;
  role: SafeRole;
};

export type CustomerAuthenticationAccount = SafeCustomerAccount & {
  password: string;
};
export type CreatedCustomerAccountIdRow = {
  id: string;
};
export type CustomerAccountWithRoleRow = {
  customer_account_id: string;
  customer_account_email: string;
  customer_account_role_id: string;
  customer_account_is_email_verified: boolean;
  customer_account_last_login: Date | null;
  customer_account_created_at: Date;
  customer_account_updated_at: Date;

  role_id: string;
  role_name: string;
  role_description: string | null;
  role_is_system: boolean;
};
export type CustomerAccountWithRoleAndPasswordRow =
  CustomerAccountWithRoleRow & {
    customer_account_password: string;
  };
export type UpdatedCustomerAccountIdRow = {
  id: string;
};

/** @deprecated Use the customer account projections in new code. */
