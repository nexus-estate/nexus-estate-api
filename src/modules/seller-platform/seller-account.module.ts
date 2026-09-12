import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { SellerAccountController } from './controllers/seller-account.controller';
import { CurrentSellerContext } from './services/current-seller-context';
import { SellerAccount } from './models/seller-account.entity';
import { SellerAccountPolicy } from './helpers/seller-account.policy';
import { SellerAccountRepository } from './repositories/seller-account.repository';
import { SellerAccountService } from './services/seller-account.service';

@Module({
  imports: [TypeOrmModule.forFeature([SellerAccount])],
  controllers: [SellerAccountController],
  providers: [
    SellerAccountRepository,
    SellerAccountService,
    SellerAccountPolicy,
    CurrentSellerContext,
  ],
  exports: [SellerAccountService, SellerAccountPolicy, CurrentSellerContext],
})
export class SellerAccountModule {}
