import { Injectable } from '@nestjs/common';
import { AuthorizationPlatform } from '../enums/authorization-platform.enum';
import { AuthorizationManagementCoreService } from '../services/authorization-management.service';
import { MarketplaceAuthorizationManagementAdapter } from '../marketplace/marketplace-authorization-management.adapter';

/** Administration adapter owns administrator subjects and recovery rules. */
@Injectable()
export class AdministrationAuthorizationManagementAdapter extends MarketplaceAuthorizationManagementAdapter {
  override readonly platform = AuthorizationPlatform.ADMINISTRATION;

  constructor(core: AuthorizationManagementCoreService) {
    super(core);
  }
}
