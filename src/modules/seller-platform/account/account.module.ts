import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { SellerAccountController } from './controllers/account.controller';
import { CurrentSellerContext } from './services/current-seller-context.service';
import { SellerAccount } from './models/account.entity';
import { SellerAccountPolicy } from './helpers/account.policy';
import { SellerAccountRepository } from './repositories/account.repository';
import { SellerAccountService } from './services/account.service';

/**
 * Nest module that owns seller-account HTTP, application, and persistence
 * components.
 */
@Module({
  imports: [TypeOrmModule.forFeature([SellerAccount])],
  controllers: [SellerAccountController],
  providers: [
    SellerAccountRepository,
    SellerAccountService,
    SellerAccountPolicy,
    CurrentSellerContext,
  ],
  exports: [
    SellerAccountRepository,
    SellerAccountService,
    SellerAccountPolicy,
    CurrentSellerContext,
  ],
})
export class SellerAccountModule {}
