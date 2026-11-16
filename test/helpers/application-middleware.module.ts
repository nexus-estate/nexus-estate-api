import { Module } from '@nestjs/common';
import type { MiddlewareConsumer, NestModule } from '@nestjs/common';

import { AppModule } from '../../src/app.module';

/** Uses production HTTP middleware configuration in tests that compose feature modules. */
@Module({})
export class ApplicationMiddlewareTestModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    new AppModule().configure(consumer);
  }
}
