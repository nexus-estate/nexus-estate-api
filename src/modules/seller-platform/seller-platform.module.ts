import { Module } from '@nestjs/common';

import { SellerAccountModule } from './seller-account.module';

@Module({ imports: [SellerAccountModule], exports: [SellerAccountModule] })
export class SellerPlatformModule {}
