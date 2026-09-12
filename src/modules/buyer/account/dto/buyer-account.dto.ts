/** Internal input for creating a buyer account with a validated role. */
export interface CreateBuyerAccountInput {
  email: string;
  passwordHash: string;
  roleId: string;
}
