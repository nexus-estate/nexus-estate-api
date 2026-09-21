import { Injectable } from '@nestjs/common';

import {
  createAuthorizationContext,
  type AuthorizationContext,
} from './authorization-context';
import { AuthorizationPlatform } from '../enums/authorization-platform.enum';

@Injectable()
/** Resolves explicit, immutable authorization contexts for application scopes. */
export class AuthorizationContextResolver {
  /**
   * Resolves the SQL configuration associated with a platform.
   *
   * @param platform Platform requested by the application boundary.
   * @returns A new immutable authorization context.
   * @throws BusinessException When the platform is unsupported.
   */
  resolve(platform: AuthorizationPlatform): AuthorizationContext {
    return createAuthorizationContext(platform);
  }
}
