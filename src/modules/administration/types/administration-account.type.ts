/** Administrator identity returned by the administration credential store. */
export type AdministrationAuthenticationAccount = {
  id: string;
  email: string;
  roleId: string;
  role: { name: string };
  password: string;
  isActive: boolean;
};
