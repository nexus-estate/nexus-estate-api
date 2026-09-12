import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';

import { CommonModule } from '../../common/common.module';
import { TokenService } from '../../common/security/token.service';
import { RbacModule } from '../rbac/rbac.module';
import { CustomerController } from './controllers/customer.controller';
import { CustomerAuthenticationController } from './controllers/customer-authentication.controller';
import { CustomerAccount } from './models/customer-account.entity';
import { CustomerAccountRepository } from './repositories/customer-account.repository';
import { CustomerAuthenticationService } from './services/customer-authentication.service';
import { CustomerAccountService } from './services/customer-account.service';
import { CustomerService } from './services/customer.service';
import { CustomerJwtAuthGuard } from './guards/customer-jwt-auth.guard';
import { CustomerJwtStrategy } from './strategies/customer-jwt.strategy';

/** Owns the customer API boundary and customer onboarding use cases. */
@Module({
  imports: [
    CommonModule,
    RbacModule,
    TypeOrmModule.forFeature([CustomerAccount]),
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.getOrThrow<string>('JWT_SECRET'),
      }),
    }),
  ],
  controllers: [CustomerController, CustomerAuthenticationController],
  providers: [
    CustomerService,
    CustomerAccountRepository,
    CustomerAccountService,
    CustomerAuthenticationService,
    CustomerJwtStrategy,
    CustomerJwtAuthGuard,
    TokenService,
  ],
  exports: [CustomerService, CustomerAccountService, CustomerJwtAuthGuard],
})
export class CustomerModule {}
