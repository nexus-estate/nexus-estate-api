import {
  Controller,
  Get,
  Module,
  ServiceUnavailableException,
  VERSION_NEUTRAL,
} from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule, TypeOrmModuleOptions } from '@nestjs/typeorm';

import { typeormConfig } from './database/type.config';
import { CommonModule } from './common/common.module';

import { Public } from './common/decorators/public.decorator';
import { LocationModule } from './modules/location/location.module';
import { EstateModule } from './modules/estate/estate.module';
import { ListingModule } from './modules/listing/listing.module';
import { LeadModule } from './modules/lead/lead.module';
import { CustomerModule } from './modules/customer/customer.module';
import { ProviderModule } from './modules/provider/provider.module';
import { AdministrationModule } from './modules/administration/administration.module';
import { validateEnvironment } from './config/environment.validation';
import { DataSource } from 'typeorm';
import { PromotionModule } from './modules/promotion/promotion.module';
@Controller({ path: 'health', version: VERSION_NEUTRAL })
@Public()
/** Exposes dependency-free liveness and database-backed readiness probes. */
export class HealthController {
  constructor(private readonly dataSource: DataSource) {}

  @Get('live')
  /** Reports process liveness without querying dependencies. */
  live() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  }

  @Get('ready')
  /** Confirms PostgreSQL readiness with a minimal SELECT 1 probe. */
  async ready() {
    try {
      await this.dataSource.query('SELECT 1');
      return { status: 'ready' };
    } catch {
      throw new ServiceUnavailableException('Database is not ready');
    }
  }
}

/** Backwards-compatible probe retained for existing deployments. */
@Controller({ path: 'healthz', version: VERSION_NEUTRAL })
@Public()
/** Keeps the legacy health route available for existing deployment probes. */
export class LegacyHealthController {
  @Get()
  /** Provides the legacy health response for older deployment probes. */
  check() {
    return { status: 'OK', timestamp: new Date().toISOString() };
  }
}

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
      load: [typeormConfig],
      validate: validateEnvironment,
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
    ListingModule,
    LeadModule,
    CustomerModule,
    ProviderModule,
    AdministrationModule,
    PromotionModule,
  ],
  controllers: [HealthController, LegacyHealthController],
})
/** Root Nest module that composes HTTP, persistence, and bounded contexts. */
export class AppModule {}
