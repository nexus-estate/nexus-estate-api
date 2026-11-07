import {
  Controller,
  Get,
  Module,
  RequestMethod,
  ServiceUnavailableException,
  VERSION_NEUTRAL,
} from '@nestjs/common';
import type { MiddlewareConsumer, NestModule } from '@nestjs/common';
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
import { MediaModule } from './modules/media/media.module';
import { RequestContextMiddleware } from './common/middleware/request-context.middleware';
import { AuthenticationMiddleware } from './common/middleware/authentication.middleware';
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
    MediaModule,
  ],
  controllers: [HealthController, LegacyHealthController],
})
/** Root Nest module that composes HTTP, persistence, and bounded contexts. */
export class AppModule implements NestModule {
  /** Applies request context and token extraction to private routes, including static route overrides. */
  configure(consumer: MiddlewareConsumer): void {
    consumer
      .apply(RequestContextMiddleware, AuthenticationMiddleware)
      .exclude(
        { path: 'health/live', method: RequestMethod.GET },
        { path: 'health/live', method: RequestMethod.HEAD },
        { path: 'health/ready', method: RequestMethod.GET },
        { path: 'health/ready', method: RequestMethod.HEAD },
        { path: 'healthz', method: RequestMethod.GET },
        { path: 'healthz', method: RequestMethod.HEAD },
        { path: 'locations/provinces', method: RequestMethod.GET },
        { path: 'locations/provinces', method: RequestMethod.HEAD },
        {
          path: 'locations/provinces/:provinceId/wards',
          method: RequestMethod.GET,
        },
        {
          path: 'locations/provinces/:provinceId/wards',
          method: RequestMethod.HEAD,
        },
        {
          path: 'locations/provinces/:provinceId/urban-wards',
          method: RequestMethod.GET,
        },
        {
          path: 'locations/provinces/:provinceId/urban-wards',
          method: RequestMethod.HEAD,
        },
        {
          path: 'locations/provinces/:provinceId/communes',
          method: RequestMethod.GET,
        },
        {
          path: 'locations/provinces/:provinceId/communes',
          method: RequestMethod.HEAD,
        },
        {
          path: 'locations/provinces/:provinceId/special-zones',
          method: RequestMethod.GET,
        },
        {
          path: 'locations/provinces/:provinceId/special-zones',
          method: RequestMethod.HEAD,
        },
        { path: 'estates', method: RequestMethod.GET },
        { path: 'estates', method: RequestMethod.HEAD },
        { path: 'estates/:id', method: RequestMethod.GET },
        { path: 'estates/:id', method: RequestMethod.HEAD },
        { path: 'estates/:estateId/media', method: RequestMethod.GET },
        { path: 'estates/:estateId/media', method: RequestMethod.HEAD },
        {
          path: 'estates/:estateId/media/:mediaId/content',
          method: RequestMethod.GET,
        },
        {
          path: 'estates/:estateId/media/:mediaId/content',
          method: RequestMethod.HEAD,
        },
        { path: 'listings', method: RequestMethod.GET },
        { path: 'listings', method: RequestMethod.HEAD },
        { path: 'listings/promoted', method: RequestMethod.GET },
        { path: 'listings/promoted', method: RequestMethod.HEAD },
        { path: 'listings/:id', method: RequestMethod.GET },
        { path: 'listings/:id', method: RequestMethod.HEAD },
        { path: 'customers/register', method: RequestMethod.POST },
        { path: 'customers/auth/login', method: RequestMethod.POST },
        { path: 'customers/auth/refresh', method: RequestMethod.POST },
        { path: 'administration/auth/login', method: RequestMethod.POST },
        { path: 'administration/auth/refresh', method: RequestMethod.POST },
        { path: 'providers/register', method: RequestMethod.POST },
        { path: 'listings/:listingId/leads', method: RequestMethod.POST },
      )
      .forRoutes('{*path}');

    // Public :id patterns also match these static private paths.
    consumer
      .apply(RequestContextMiddleware, AuthenticationMiddleware)
      .forRoutes(
        { path: 'estates/mine', method: RequestMethod.GET },
        { path: 'listings/mine', method: RequestMethod.GET },
        { path: 'listings/eligible-properties', method: RequestMethod.GET },
      );
  }
}
