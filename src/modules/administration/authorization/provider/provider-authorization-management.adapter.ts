import { Injectable } from '@nestjs/common';
import { AuthorizationPlatform } from '../enums/authorization-platform.enum';
import { AuthorizationManagementCoreService } from '../services/authorization-management.service';
import { MarketplaceAuthorizationManagementAdapter } from '../marketplace/marketplace-authorization-management.adapter';

/** Provider adapter owns provider-membership subjects and provider tables. */
@Injectable()
export class ProviderAuthorizationManagementAdapter extends MarketplaceAuthorizationManagementAdapter {
  override readonly platform = AuthorizationPlatform.PROVIDER;

  constructor(core: AuthorizationManagementCoreService) {
    super(core);
  }
}
