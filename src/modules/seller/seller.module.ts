import { Module } from '@nestjs/common';

import { RbacModule } from '../rbac/rbac.module';
import { SellerPlatformModule } from '../seller-platform/seller-platform.module';
import { BuyerAccountModule } from '../buyer/account/buyer-account.module';
import { SellerController } from './controllers/seller.controller';
import { SellerProfileService } from './services/seller-profile.service';
import { SellerRegistrationService } from './services/seller-registration.service';

/** Owns seller registration and seller-facing API access. */
@Module({
  imports: [RbacModule, SellerPlatformModule, BuyerAccountModule],
  controllers: [SellerController],
  providers: [SellerProfileService, SellerRegistrationService],
  exports: [SellerProfileService, SellerRegistrationService],
})
export class SellerModule {}
