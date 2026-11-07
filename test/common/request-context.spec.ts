import {
  Controller,
  Module,
  RequestMapping,
  RequestMethod,
} from '@nestjs/common';
import type {
  INestApplication,
  MiddlewareConsumer,
  NestModule,
  Type,
} from '@nestjs/common';
import { METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import type { Server } from 'node:http';
import request from 'supertest';

import {
  AppModule,
  HealthController,
  LegacyHealthController,
} from '../../src/app.module';
import { CommonModule } from '../../src/common/common.module';
import { IS_PUBLIC_KEY } from '../../src/common/decorators/public.decorator';
import { AuthenticationMiddleware } from '../../src/common/middleware/authentication.middleware';
import { RequestContextMiddleware } from '../../src/common/middleware/request-context.middleware';
import { AuthSessionService } from '../../src/common/security/auth-session.service';
import { AdministrationAuthenticationController } from '../../src/modules/administration/authentication/controllers/administration-authentication.controller';
import { CustomerController } from '../../src/modules/customer/account/controllers/customer.controller';
import { CustomerAuthenticationController } from '../../src/modules/customer/authentication/controllers/customer-authentication.controller';
import { EstateController } from '../../src/modules/estate/property/controllers/estate.controller';
import { LeadController } from '../../src/modules/lead/lead/controllers/lead.controller';
import { ListingController } from '../../src/modules/listing/listing/controllers/listing.controller';
import { LocationController } from '../../src/modules/location/administrative-division/controllers/location.controller';
import { MediaController } from '../../src/modules/media/asset/controllers/media.controller';
import { ProviderController } from '../../src/modules/provider/registration/controllers/provider.controller';

type RouteCase = {
  method: 'get' | 'head' | 'post' | 'patch' | 'delete';
  path: string;
  isPublic: boolean;
};

const routes: RouteCase[] = [];
const reflector = new Reflector();

// Exercise real controller paths and public metadata without business services or a database.
const controllers = [
  HealthController,
  LegacyHealthController,
  CustomerController,
  CustomerAuthenticationController,
  AdministrationAuthenticationController,
  LocationController,
  ProviderController,
  EstateController,
  ListingController,
  LeadController,
  MediaController,
].map((source: Type<object>) => {
  class RouteFixture {}
  const controllerPath = reflector.get<string>(PATH_METADATA, source);
  Controller(controllerPath)(RouteFixture);

  for (const name of Object.getOwnPropertyNames(source.prototype)) {
    const handler: unknown = Object.getOwnPropertyDescriptor(
      source.prototype,
      name,
    )?.value;
    if (typeof handler !== 'function') continue;
    const method = reflector.get<RequestMethod>(METHOD_METADATA, handler);
    if (method === undefined) continue;
    const path = reflector.get<string>(PATH_METADATA, handler);
    const isPublic =
      reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [handler, source]) ??
      false;

    Object.defineProperty(RouteFixture.prototype, name, {
      value: () => ({ ok: true }),
      configurable: true,
    });
    const descriptor = Object.getOwnPropertyDescriptor(
      RouteFixture.prototype,
      name,
    )!;
    RequestMapping({ path, method })(RouteFixture.prototype, name, descriptor);

    const routePath = [controllerPath, path]
      .filter((part) => part && part !== '/')
      .join('/')
      .replace(/:[^/]+/g, '11111111-1111-4111-8111-111111111111');
    const url = controllerPath.startsWith('health')
      ? `/${routePath}`
      : `/api/v1/${routePath}`;
    routes.push({
      method: RequestMethod[method].toLowerCase() as RouteCase['method'],
      path: url,
      isPublic,
    });
    if (method === RequestMethod.GET) {
      routes.push({ method: 'head', path: url, isPublic });
    }
  }
  return RouteFixture;
});

@Module({ imports: [CommonModule], controllers })
class RequestContextTestModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    new AppModule().configure(consumer);
  }
}

describe('Request context route exclusions (HTTP)', () => {
  let app: INestApplication;
  const use = jest.spyOn(RequestContextMiddleware.prototype, 'use');
  const authenticate = jest.spyOn(AuthenticationMiddleware.prototype, 'use');

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [RequestContextTestModule],
    })
      .overrideProvider(AuthSessionService)
      .useValue({})
      .compile();
    app = module.createNestApplication();
    app.setGlobalPrefix('api/v1', {
      exclude: ['healthz', 'health/{*path}'],
    });
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
    use.mockRestore();
    authenticate.mockRestore();
  });

  it.each(routes)('$method $path (public=$isPublic)', async (route) => {
    use.mockClear();
    authenticate.mockClear();
    const response = await request(app.getHttpServer() as Server)
      [route.method](`${route.path}/?check=public-exclusion`)
      .set('X-Request-Id', 'route-context-regression')
      .set('X-Lang', 'vi')
      .set('Authorization', 'Bearer route-token');

    expect(response.status).toBeLessThan(400);
    expect(authenticate).toHaveBeenCalledTimes(route.isPublic ? 0 : 1);
    if (!route.isPublic) {
      expect(authenticate.mock.calls[0][0].accessToken).toBe('route-token');
    }
    expect(use).toHaveBeenCalledTimes(route.isPublic ? 0 : 1);
    expect(response.headers['x-request-id']).toBe(
      route.isPublic ? undefined : 'route-context-regression',
    );
    expect(response.headers['content-language']).toBe(
      route.isPublic ? undefined : 'vi',
    );
  });
});
