import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';

import { CommonModule } from '../../common/common.module';
import { TokenService } from '../../common/security/token.service';
import { CustomerController } from './account/controllers/customer.controller';
import { CustomerAuthenticationController } from './authentication/controllers/customer-authentication.controller';
import { CustomerAccount } from './account/entities/customer-account.entity';
import { CustomerAccountRepository } from './account/repositories/customer-account.repository';
import { CustomerAuthenticationService } from './authentication/services/customer-authentication.service';
import { CustomerAccountService } from './account/services/customer-account.service';
import { CustomerService } from './account/services/customer.service';
import { CustomerJwtAuthGuard } from './authentication/guards/customer-jwt-auth.guard';
import { CustomerJwtStrategy } from './authentication/strategies/customer-jwt.strategy';
import { MarketplaceRole } from './authorization/entities/marketplace-role.entity';
import { MarketplacePermission } from './authorization/entities/marketplace-permission.entity';
import { MarketplaceRolePermission } from './authorization/entities/marketplace-role-permission.entity';
import { CustomerRoleAssignment } from './authorization/entities/customer-role-assignment.entity';
import { CustomerAuthorizationService } from './authorization/services/customer-authorization.service';

/** Owns the customer API boundary and customer onboarding use cases. */
@Module({
  imports: [
    CommonModule,
    TypeOrmModule.forFeature([
      CustomerAccount,
      MarketplaceRole,
      MarketplacePermission,
      MarketplaceRolePermission,
      CustomerRoleAssignment,
    ]),
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
    CustomerAuthorizationService,
  ],
  exports: [CustomerService, CustomerAccountService, CustomerJwtAuthGuard],
})
export class CustomerModule {}
