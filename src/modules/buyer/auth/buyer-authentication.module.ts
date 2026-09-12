import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';

import { BuyerAccountModule } from '../account/buyer-account.module';
import { BuyerAuthenticationController } from './controllers/buyer-authentication.controller';
import { BuyerJwtAuthGuard } from './guards/buyer-jwt-auth.guard';
import { BuyerAuthenticationService } from './services/buyer-authentication.service';
import { BuyerJwtStrategy } from './strategies/buyer-jwt.strategy';

/** Authentication boundary for buyer and seller-facing sessions. */
@Module({
  imports: [
    BuyerAccountModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.getOrThrow<string>('JWT_SECRET'),
      }),
    }),
  ],
  providers: [BuyerAuthenticationService, BuyerJwtStrategy, BuyerJwtAuthGuard],
  controllers: [BuyerAuthenticationController],
  exports: [BuyerAuthenticationService, BuyerJwtAuthGuard],
})
export class BuyerAuthenticationModule {}
