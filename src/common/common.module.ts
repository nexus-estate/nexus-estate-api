import { Global, Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { HttpExceptionFilter } from './filters/http-exception.filter';
import { BusinessExceptionFilter } from './filters/business-exception.filter';
import { TransformInterceptor } from './interceptors/transform.interceptor';
import { BcryptService } from './security/bcrypt.service';
import { AuthSessionService } from './security/auth-session.service';

@Global()
@Module({
  imports: [
    ThrottlerModule.forRoot([
      {
        name: 'default',
        ttl: 60_000,
        limit: 100,
      },
    ]),
  ],
  providers: [
    BcryptService,
    AuthSessionService,
    {
      provide: APP_FILTER,
      useClass: HttpExceptionFilter,
    },
    {
      provide: APP_FILTER,
      useClass: BusinessExceptionFilter,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: TransformInterceptor,
    },
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
  exports: [BcryptService, AuthSessionService],
})
/** Shared infrastructure module for errors, throttling, and cross-cutting HTTP behavior. */
export class CommonModule {}
