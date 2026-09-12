import { Module } from '@nestjs/common';

import { SellerAccountModule } from './seller-account/seller-account.module';

@Module({ imports: [SellerAccountModule], exports: [SellerAccountModule] })
export class SellerPlatformModule {}
