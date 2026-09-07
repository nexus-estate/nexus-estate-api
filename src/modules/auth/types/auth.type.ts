// type user after authenication
export type AuthenticatedPrincipal = {
  id: string;
  email: string;
  roleId: string;
  role: string;
};
export type TokenType = 'access' | 'refresh';

export type JwtPayload = {
  sub: string;
  type: TokenType;
};

//type JWT return
export type TokenPair = {
  accessToken: string;
  refreshToken: string;
};
