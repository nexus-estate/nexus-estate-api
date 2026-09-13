import { Injectable } from '@nestjs/common';
import { BusinessException } from '../../../../common/exceptions/business.exception';
import { AuthorizationErrorCodes } from '../errors/authorization-error-codes';
import { AuthorizationPlatform } from '../enums/authorization-platform.enum';
import { AdministrationAuthorizationManagementAdapter } from '../administration/administration-authorization-management.adapter';
import { MarketplaceAuthorizationManagementAdapter } from '../marketplace/marketplace-authorization-management.adapter';
import { ProviderAuthorizationManagementAdapter } from '../provider/provider-authorization-management.adapter';
import { AuthorizationManagementCoreService } from '../services/authorization-management.service';
import type { PlatformAuthorizationManagementPort } from './platform-authorization-management.port';

/** Selects a platform-owned management adapter from trusted internal config. */
@Injectable()
export class PlatformAuthorizationAdapterRegistry {
  private readonly adapters: ReadonlyMap<
    AuthorizationPlatform,
    PlatformAuthorizationManagementPort
  >;

  constructor(core: AuthorizationManagementCoreService) {
    this.adapters = new Map([
      [
        AuthorizationPlatform.MARKETPLACE,
        new MarketplaceAuthorizationManagementAdapter(core),
      ],
      [
        AuthorizationPlatform.PROVIDER,
        new ProviderAuthorizationManagementAdapter(core),
      ],
      [
        AuthorizationPlatform.ADMINISTRATION,
        new AdministrationAuthorizationManagementAdapter(core),
      ],
    ]);
  }

  /** Returns the trusted adapter for a platform or a stable platform error. */
  for(platform: AuthorizationPlatform): PlatformAuthorizationManagementPort {
    const adapter = this.adapters.get(platform);
    if (!adapter) {
      throw new BusinessException(AuthorizationErrorCodes.PLATFORM_NOT_FOUND, {
        platform,
      });
    }
    return adapter;
  }
}
