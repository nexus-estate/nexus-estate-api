import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { SellerAccountController } from './controller';
import { CurrentSellerContext } from './current-seller-context';
import { SellerAccount } from './entity';
import { SellerAccountPolicy } from './policy';
import { SellerAccountRepository } from './repository';
import { SellerAccountService } from './service';

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
