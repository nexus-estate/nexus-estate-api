import { Module } from '@nestjs/common';

import { SellerAccountModule } from './account/account.module';

@Module({ imports: [SellerAccountModule], exports: [SellerAccountModule] })
export class SellerPlatformModule {}
