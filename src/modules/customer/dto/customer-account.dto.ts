/** Internal input for creating a customer account with a validated role. */
export interface CreateCustomerAccountInput {
  email: string;
  passwordHash: string;
  roleId: string;
}
