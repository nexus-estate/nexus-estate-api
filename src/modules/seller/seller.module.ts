import { Module } from '@nestjs/common';

import { RbacModule } from '../rbac/rbac.module';
import { SellerPlatformModule } from '../seller-platform/seller-platform.module';
import { UserModule } from '../user/user.module';
import { SellerApprovalController } from './controllers/seller-approval.controller';
import { SellerController } from './controllers/seller.controller';
import { SellerApprovalService } from './services/seller-approval.service';
import { SellerProfileService } from './services/seller-profile.service';
import { SellerRegistrationService } from './services/seller-registration.service';

/** Owns seller registration and seller-facing API access. */
@Module({
  imports: [RbacModule, SellerPlatformModule, UserModule],
  controllers: [SellerController, SellerApprovalController],
  providers: [
    SellerApprovalService,
    SellerProfileService,
    SellerRegistrationService,
  ],
  exports: [
    SellerApprovalService,
    SellerProfileService,
    SellerRegistrationService,
  ],
})
export class SellerModule {}
