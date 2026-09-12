import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { RbacModule } from '../../rbac/rbac.module';
import { BuyerAccount } from './models/buyer-account.entity';
import { BuyerAccountRepository } from './repositories/buyer-account.repository';
import { BuyerAccountService } from './services/buyer-account.service';

/** Owns buyer identity persistence and buyer-account application services. */
@Module({
  imports: [TypeOrmModule.forFeature([BuyerAccount]), RbacModule],
  providers: [BuyerAccountRepository, BuyerAccountService],
  exports: [BuyerAccountService],
})
export class BuyerAccountModule {}
