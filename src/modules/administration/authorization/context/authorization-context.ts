import { BusinessException } from '../../../../common/exceptions/business.exception';
import { AuthorizationErrorCodes } from '../errors/authorization-error-codes';
import { AuthorizationPlatform } from '../enums/authorization-platform.enum';
import {
  platformAuthorizationSqlConfig,
  type PlatformAuthorizationSqlConfig,
} from '../management/platform-authorization-config';

/**
 * Immutable platform-specific authorization data carried through one operation
 * tree.
 *
 * The context is explicit and safe to share between concurrent operations. It
 * contains no request state and no service instances.
 */
export interface AuthorizationContext {
  /** Authorization domain selected by the caller. */
  readonly platform: AuthorizationPlatform;

  /** SQL table mapping belonging to {@link platform}. */
  readonly config: PlatformAuthorizationSqlConfig;
}

/**
 * Context or legacy platform input accepted at migration boundaries.
 *
 * New application code should resolve a context once through
 * {@link AuthorizationContextResolver} or {@link AuthorizationService.for}.
 */
export type AuthorizationContextInput =
  AuthorizationContext | AuthorizationPlatform;

/**
 * Creates a frozen authorization context for a platform.
 *
 * @param platform Platform whose authorization tables should be selected.
 * @returns A new immutable context instance.
 * @throws BusinessException When the platform has no authorization config.
 */
export function createAuthorizationContext(
  platform: AuthorizationPlatform,
): AuthorizationContext {
  const config = platformAuthorizationSqlConfig(platform);
  if (!config) {
    throw new BusinessException(AuthorizationErrorCodes.PLATFORM_NOT_FOUND, {
      platform,
    });
  }
  return Object.freeze({ platform, config: Object.freeze(config) });
}

/**
 * Normalizes a context or legacy platform value into an authorization context.
 * Existing context objects are returned unchanged to preserve scope identity.
 *
 * @param input Context or platform value supplied by a migrating caller.
 * @returns The immutable authorization context to pass downstream.
 */
export function authorizationContext(
  input: AuthorizationContextInput,
): AuthorizationContext {
  return typeof input === 'object' ? input : createAuthorizationContext(input);
}
