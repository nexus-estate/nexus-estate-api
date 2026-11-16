import { randomUUID } from 'node:crypto';
import type { Server } from 'node:http';
import { join } from 'node:path';
import { ValidationPipe } from '@nestjs/common';
import type { INestApplication } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  PostgreSqlContainer,
  type StartedPostgreSqlContainer,
} from '@testcontainers/postgresql';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { SnakeNamingStrategy } from 'typeorm-naming-strategies';

import { AuthenticationMiddleware } from '../../src/common/middleware/authentication.middleware';
import { BcryptService } from '../../src/common/security/bcrypt.service';
import type {
  JwtPayload,
  TokenPair,
} from '../../src/common/security/auth.types';
import { AdministrationModule } from '../../src/modules/administration/administration.module';
import { AdministratorAccount } from '../../src/modules/administration/authentication/entities/administrator-account.entity';
import { AdministrationJwtStrategy } from '../../src/modules/administration/authentication/strategies/administration-jwt.strategy';
import { CustomerAccount } from '../../src/modules/customer/account/entities/customer-account.entity';
import { CustomerModule } from '../../src/modules/customer/customer.module';
import { CustomerJwtStrategy } from '../../src/modules/customer/authentication/strategies/customer-jwt.strategy';
import { ApplicationMiddlewareTestModule } from '../helpers/application-middleware.module';

const realms = [
  {
    realm: 'customer',
    prefix: '/api/v1/customers/auth',
    accessSecret: 'authentication-e2e-customer-access-secret',
    privateMethod: 'get',
    privatePath: '/api/v1/customers/auth/profile',
  },
  {
    realm: 'administration',
    prefix: '/api/v1/administration/auth',
    accessSecret: 'authentication-e2e-administration-access-secret',
    privateMethod: 'post',
    privatePath: '/api/v1/administration/auth/logout',
  },
] as const;

type Realm = (typeof realms)[number]['realm'];
type ApiSuccess<T> = { data: T };

describe('Authentication middleware and realm strategies (HTTP + PostgreSQL)', () => {
  let container: StartedPostgreSqlContainer;
  let app: INestApplication<Server>;
  let dataSource: DataSource;
  const tokens = {} as Record<Realm, TokenPair>;
  const accountIds = {} as Record<Realm, string>;
  const password = 'authentication-e2e-password';
  const email = (realm: Realm) => `${realm}@authentication.nexus.test`;
  const jwt = new JwtService();
  const extract = jest.spyOn(AuthenticationMiddleware.prototype, 'use');
  const customerValidate = jest.spyOn(
    CustomerJwtStrategy.prototype,
    'validate',
  );
  const administrationValidate = jest.spyOn(
    AdministrationJwtStrategy.prototype,
    'validate',
  );

  beforeAll(async () => {
    container = await new PostgreSqlContainer('postgres:18-alpine')
      .withDatabase('nexus_estate_authentication_e2e')
      .withUsername('test')
      .withPassword('test')
      .start();
    const module = await Test.createTestingModule({
      imports: [
        ApplicationMiddlewareTestModule,
        ConfigModule.forRoot({
          isGlobal: true,
          ignoreEnvFile: true,
          load: [
            () => ({
              CUSTOMER_JWT_ACCESS_SECRET: realms[0].accessSecret,
              CUSTOMER_JWT_REFRESH_SECRET:
                'authentication-e2e-customer-refresh',
              ADMIN_JWT_ACCESS_SECRET: realms[1].accessSecret,
              ADMIN_JWT_REFRESH_SECRET: 'authentication-e2e-admin-refresh',
            }),
          ],
        }),
        TypeOrmModule.forRoot({
          type: 'postgres',
          host: container.getHost(),
          port: container.getPort(),
          username: container.getUsername(),
          password: container.getPassword(),
          database: container.getDatabase(),
          entities: [join(__dirname, '../../src/**/*.entity.ts')],
          namingStrategy: new SnakeNamingStrategy(),
          synchronize: true,
        }),
        CustomerModule,
        AdministrationModule,
      ],
    }).compile();
    app = module.createNestApplication<INestApplication<Server>>();
    app.useLogger(false);
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
    dataSource = module.get(DataSource);
    const hash = await new BcryptService().hash(password);
    accountIds.customer = (
      await dataSource.getRepository(CustomerAccount).save({
        email: email('customer'),
        password: hash,
      })
    ).id;
    accountIds.administration = (
      await dataSource.getRepository(AdministratorAccount).save({
        email: email('administration'),
        password: hash,
      })
    ).id;
    for (const realm of realms) {
      const response = await request(app.getHttpServer())
        .post(`${realm.prefix}/login`)
        .send({ email: email(realm.realm), password })
        .expect(201);
      tokens[realm.realm] = (response.body as ApiSuccess<TokenPair>).data;
    }
  });

  afterAll(async () => {
    await app?.close();
    await container?.stop();
    extract.mockRestore();
    customerValidate.mockRestore();
    administrationValidate.mockRestore();
  });

  describe.each(realms)('$realm', (realm) => {
    const privateRequest = () =>
      request(app.getHttpServer())
        [realm.privateMethod](realm.privatePath)
        .send(
          realm.realm === 'administration'
            ? { refreshToken: tokens.administration.refreshToken }
            : undefined,
        );

    const sign = (
      claims: Partial<JwtPayload> = {},
      expiresIn = 60,
      secret: string = realm.accessSecret,
    ) =>
      jwt.sign(
        {
          sub: accountIds[realm.realm],
          realm: realm.realm,
          tokenType: 'access',
          sessionId: randomUUID(),
          ...claims,
        },
        { secret, expiresIn },
      );

    it('returns 401 without a token and retains request context on private endpoints', async () => {
      const response = await privateRequest()
        .set('X-Request-Id', 'authentication-private')
        .set('X-Lang', 'vi')
        .expect(401);
      expect(response.headers['x-request-id']).toBe('authentication-private');
      expect(response.headers['content-language']).toBe('vi');
      expect(response.body as unknown).toMatchObject({
        request_id: 'authentication-private',
      });
    });

    it.each([
      'Basic credentials',
      'Bearer',
      'Bearer token extra',
      'Bearer  token',
      'bearer token',
    ])('returns 401 for malformed Authorization: %s', async (authorization) => {
      await privateRequest().set('Authorization', authorization).expect(401);
    });

    it('returns 401 for an expired token', async () => {
      await privateRequest()
        .set('Authorization', `Bearer ${sign({}, -60)}`)
        .expect(401);
    });

    it('returns 401 for an invalid signature', async () => {
      await privateRequest()
        .set('Authorization', `Bearer ${sign({}, 60, 'wrong-signing-secret')}`)
        .expect(401);
    });

    it('returns 401 for the other realm token', async () => {
      const otherRealm =
        realm.realm === 'customer' ? 'administration' : 'customer';
      await privateRequest()
        .set('Authorization', `Bearer ${tokens[otherRealm].accessToken}`)
        .expect(401);
    });

    it.each<Partial<JwtPayload>>([
      { realm: 'customer' === realm.realm ? 'administration' : 'customer' },
      { realm: undefined },
      { tokenType: 'refresh' },
      { sessionId: undefined },
    ])(
      'returns 401 for invalid claims signed with the correct key: %j',
      async (claims) => {
        await privateRequest()
          .set('Authorization', `Bearer ${sign(claims)}`)
          .expect(401);
      },
    );

    it('extracts the token before the strategy and preserves the login/refresh/logout flow', async () => {
      const login = await request(app.getHttpServer())
        .post(`${realm.prefix}/login`)
        .set('X-Request-Id', 'authentication-public')
        .expect('X-Request-Id', 'authentication-public')
        .send({ email: email(realm.realm), password })
        .expect(201);
      const initial = (login.body as ApiSuccess<TokenPair>).data;
      const refreshBody = (token: string) =>
        realm.realm === 'customer'
          ? { refreshTokenString: token }
          : { refreshToken: token };
      // Public refresh must use the body even when the access header is invalid.
      const refresh = await request(app.getHttpServer())
        .post(`${realm.prefix}/refresh`)
        .set('Authorization', 'Bearer invalid-access-token')
        .send(refreshBody(initial.refreshToken))
        .expect(201);
      const rotated = (refresh.body as ApiSuccess<TokenPair>).data;
      const validate =
        realm.realm === 'customer' ? customerValidate : administrationValidate;
      extract.mockClear();
      validate.mockClear();
      if (realm.realm === 'customer') {
        const profile = await request(app.getHttpServer())
          .get(realm.privatePath)
          .set('Authorization', `Bearer ${rotated.accessToken}`)
          .expect(200);
        expect(profile.body as unknown).toMatchObject({
          data: { id: accountIds.customer, email: email('customer') },
        });
      }
      const logout = await request(app.getHttpServer())
        .post(`${realm.prefix}/logout`)
        .set('Authorization', `Bearer ${rotated.accessToken}`)
        .send(refreshBody(rotated.refreshToken))
        .expect(201);
      expect(logout.body as unknown).toMatchObject({
        data: { loggedOut: true },
      });
      expect(extract.mock.calls[0][0].accessToken).toBe(rotated.accessToken);
      expect(extract.mock.invocationCallOrder[0]).toBeLessThan(
        validate.mock.invocationCallOrder[0],
      );
      expect(validate.mock.calls[0][0]).toMatchObject({
        sub: accountIds[realm.realm],
        realm: realm.realm,
      });
      await request(app.getHttpServer())
        .post(`${realm.prefix}/refresh`)
        .send(refreshBody(rotated.refreshToken))
        .expect(401);
    });
  });
});
