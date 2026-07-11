/**
 * JWT payload structure decoded from access token.
 */
interface JwtPayload {
  sub: string; // user ID
  role: string; // user role name
  iat?: number;
  exp?: number;
}

/**
 * Authenticated user attached to request by JwtAuthGuard.
 */
interface AuthUser {
  id: string;
  email: string;
  roleId: string;
  role: string;
}

/**
 * Express request extended with authenticated user context.
 */
declare namespace Express {
  interface Request {
    user?: AuthUser;
  }
}
