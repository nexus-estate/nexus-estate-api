import { Module } from '@nestjs/common';

import { RbacModule } from '../rbac/rbac.module';
import { BuyerAccountModule } from './account/buyer-account.module';
import { BuyerAuthenticationModule } from './auth/buyer-authentication.module';
import { BuyerController } from './controllers/buyer.controller';
import { BuyerService } from './services/buyer.service';

/** Owns the buyer API boundary and buyer onboarding use cases. */
@Module({
  imports: [RbacModule, BuyerAccountModule, BuyerAuthenticationModule],
  controllers: [BuyerController],
  providers: [BuyerService],
  exports: [BuyerService],
})
export class BuyerModule {}
