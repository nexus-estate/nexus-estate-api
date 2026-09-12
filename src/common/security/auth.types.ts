/**
 * The authenticated identity shared by authorization infrastructure.
 *
 * Domain modules own how a principal is authenticated. They only expose this
 * small transport contract to the common role and permission guards.
 */
export type AuthenticatedPrincipal = {
  id: string;
  email: string;
  roleId: string;
  role: string;
};

/** Identifies the authentication boundary that issued a JWT. */
export type AuthenticationContext = 'buyer' | 'administration';

/** Claims carried by access and refresh tokens. */
export type JwtPayload = {
  sub: string;
  type: 'access' | 'refresh';
  aud: AuthenticationContext;
};

/** Access/refresh token pair returned by an authentication boundary. */
export type TokenPair = {
  accessToken: string;
  refreshToken: string;
};
