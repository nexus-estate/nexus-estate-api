import { Module } from '@nestjs/common';

import { RbacModule } from '../rbac/rbac.module';
import { UserModule } from '../user/user.module';
import { BuyerController } from './controllers/buyer.controller';
import { BuyerService } from './services/buyer.service';

/** Owns the buyer API boundary and buyer onboarding use cases. */
@Module({
  imports: [RbacModule, UserModule],
  controllers: [BuyerController],
  providers: [BuyerService],
  exports: [BuyerService],
})
export class BuyerModule {}
