import { Module, Controller, Get, VERSION_NEUTRAL } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule, TypeOrmModuleOptions } from '@nestjs/typeorm';

import { typeormConfig } from './database/type.config';
import { CommonModule } from './common/common.module';

import { Public } from './common/decorators/public.decorator';
import { LocationModule } from './database/seed/locations/location.module';
import { EstateModule } from './modules/estate/estate.module';
import { CustomerModule } from './modules/customer/customer.module';
import { ProviderModule } from './modules/provider/provider.module';
import { AdministrationModule } from './modules/administration/administration.module';
@Controller({
  path: 'healthz',
  version: VERSION_NEUTRAL,
})
@Public()
export class HealthController {
  @Get()
  check() {
    return {
      status: 'OK',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'staging',
    };
  }
}

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
      load: [typeormConfig],
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        ...configService.get<TypeOrmModuleOptions>('typeorm')!,
        autoLoadEntities: true,
      }),
    }),
    CommonModule,
    LocationModule,
    EstateModule,
    CustomerModule,
    ProviderModule,
    AdministrationModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
