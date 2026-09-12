/** Principal authenticated by the public customer realm. */
export type CustomerPrincipal = {
  id: string;
  email: string;
  realm: 'customer';
};

/** Principal authenticated by the internal administration realm. */
export type AdministrationPrincipal = {
  id: string;
  email: string;
  realm: 'administration';
};

/**
 * Compatibility request shape for code that has not yet adopted a realm
 * specific principal type. New runtime authorization must use one of the
 * explicit principal types above.
 *
 * @deprecated Use CustomerPrincipal or AdministrationPrincipal.
 */
export type AuthenticatedPrincipal = {
  id: string;
  email: string;
  realm?: AuthenticationContext;
  /** @deprecated Global roles are no longer runtime authorization state. */
  roleId?: string;
  /** @deprecated Global roles are no longer runtime authorization state. */
  role?: string;
};

/** Identifies the authentication boundary that issued a JWT. */
export type AuthenticationContext = 'customer' | 'administration';

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
