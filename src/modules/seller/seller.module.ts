import { Module } from '@nestjs/common';

import { RbacModule } from '../rbac/rbac.module';
import { SellerPlatformModule } from '../seller-platform/seller-platform.module';
import { UserModule } from '../user/user.module';
import { SellerController } from './controllers/seller.controller';
import { SellerService } from './services/seller.service';

/** Owns seller registration and seller-facing API access. */
@Module({
  imports: [RbacModule, SellerPlatformModule, UserModule],
  controllers: [SellerController],
  providers: [SellerService],
  exports: [SellerService],
})
export class SellerModule {}
