import type { Request } from 'express';
import type { CustomerPrincipal } from '../../../../common/security/auth.types';

/** Request authenticated by CustomerJwtAuthGuard in the Customer realm. */
export interface AuthenticationRequest extends Request {
  user: CustomerPrincipal;
}
