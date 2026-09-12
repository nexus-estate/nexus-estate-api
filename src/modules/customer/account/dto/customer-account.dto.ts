/** Internal customer-account creation input. */
export interface CreateCustomerAccountInput {
  email: string;
  passwordHash: string;
  /** @deprecated Accepted during expand only; never used for authorization. */
  roleId?: string;
}
