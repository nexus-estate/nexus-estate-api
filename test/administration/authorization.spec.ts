/* eslint-disable @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import {
  PostgreSqlContainer,
  type StartedPostgreSqlContainer,
} from '@testcontainers/postgresql';
import bcrypt from 'bcrypt';
import { DataSource } from 'typeorm';
import request from 'supertest';

jest.setTimeout(120_000);

describe('Administration authorization management (HTTP + PostgreSQL)', () => {
  let container: StartedPostgreSqlContainer;
  let app: INestApplication;
  let dataSource: DataSource;
  let accessToken: string;
  const adminEmail = 'authorization-e2e@nexus.test';
  const adminPassword = 'authorization-e2e-password';
  const requestId = 'authorization-e2e-request';

  beforeAll(async () => {
    container = await new PostgreSqlContainer('postgres:18-alpine')
      .withDatabase('nexus_estate_authorization_e2e')
      .withUsername('test')
      .withPassword('test')
      .start();

    process.env.DB_POSTGRES_HOST = container.getHost();
    process.env.DB_POSTGRES_PORT = String(container.getPort());
    process.env.DB_POSTGRES_USER = container.getUsername();
    process.env.DB_POSTGRES_PASS = container.getPassword();
    process.env.DB_POSTGRES_NAME = container.getDatabase();
    process.env.CUSTOMER_JWT_ACCESS_SECRET =
      'authorization-e2e-customer-access-secret-32';
    process.env.CUSTOMER_JWT_REFRESH_SECRET =
      'authorization-e2e-customer-refresh-secret-32';
    process.env.ADMIN_JWT_ACCESS_SECRET =
      'authorization-e2e-administration-access-secret-32';
    process.env.ADMIN_JWT_REFRESH_SECRET =
      'authorization-e2e-administration-refresh-secret-32';

    // Import after test-container configuration because the production
    // TypeORM config reads database settings at module load time.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { AppModule } = require('../../src/app.module');
    app = await NestFactory.create(AppModule);
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();

    dataSource = app.get(DataSource);
    await dataSource.runMigrations();
    const password = await bcrypt.hash(adminPassword, 10);
    const [{ id: administratorId }] = await dataSource.query<{ id: string }[]>(
      `INSERT INTO tbl_administrator_account (email, password, is_active)
       VALUES ($1, $2, true) RETURNING id`,
      [adminEmail, password],
    );
    const [{ id: roleId }] = await dataSource.query<{ id: string }[]>(
      `SELECT id FROM tbl_administration_role WHERE code = 'SUPER_ADMIN'`,
    );
    await dataSource.query(
      `INSERT INTO tbl_administrator_role_assignment (administrator_id, role_id)
       VALUES ($1, $2)`,
      [administratorId, roleId],
    );

    const login = await request(app.getHttpServer())
      .post('/api/v1/administration/auth/login')
      .send({ email: adminEmail, password: adminPassword })
      .expect(201);
    accessToken = login.body.data.accessToken;
  });

  afterAll(async () => {
    await app?.close();
    await container?.stop();
  });

  const management = () => {
    const withHeaders = <T extends request.Test>(test: T): T =>
      test
        .set('Authorization', `Bearer ${accessToken}`)
        .set('X-Request-Id', requestId);
    const http = request(app.getHttpServer());
    return {
      get: (path: string) => withHeaders(http.get(path)),
      post: (path: string) => withHeaders(http.post(path)),
      patch: (path: string) => withHeaders(http.patch(path)),
      put: (path: string) => withHeaders(http.put(path)),
      delete: (path: string) => withHeaders(http.delete(path)),
    };
  };

  it('serves the normalized platform and role lifecycle contract', async () => {
    await management()
      .get('/api/v1/administration/authorization/platforms')
      .expect(200)
      .expect(({ body }) => {
        expect(
          body.data.items.map((item: { platform: string }) => item.platform),
        ).toEqual(['MARKETPLACE', 'PROVIDER', 'ADMINISTRATION']);
      });

    const created = await management()
      .post('/api/v1/administration/authorization/PROVIDER/roles')
      .send({ code: 'E2E_MANAGER', name: 'E2E Manager', permissionIds: [] })
      .expect(201);
    expect(created.body.data).toMatchObject({
      code: 'E2E_MANAGER',
      permissionCount: 0,
      assignmentCount: 0,
      allowedActions: {
        updateMetadata: true,
        updateStatus: true,
        updatePermissions: true,
        delete: true,
      },
      isEditable: true,
      isDeletable: true,
    });

    const current = await management()
      .get(
        `/api/v1/administration/authorization/PROVIDER/roles/${created.body.data.id}`,
      )
      .expect(200);
    const updated = await management()
      .patch(
        `/api/v1/administration/authorization/PROVIDER/roles/${created.body.data.id}`,
      )
      .send({
        name: 'Updated E2E Manager',
        expectedVersion: current.body.data.version,
      })
      .expect(200);
    expect(updated.body.data.version).toBe(current.body.data.version + 1);
    expect(updated.body.data.updatedAt).toBeDefined();

    await management()
      .patch(
        `/api/v1/administration/authorization/PROVIDER/roles/${created.body.data.id}`,
      )
      .send({ name: 'stale', expectedVersion: current.body.data.version })
      .expect(409)
      .expect(({ body }) => {
        expect(body.code).toBe('AUTHORIZATION_ROLE_VERSION_CONFLICT');
        expect(body.request_id).toBe(requestId);
      });

    await management()
      .delete(
        `/api/v1/administration/authorization/PROVIDER/roles/${created.body.data.id}`,
      )
      .expect(200);

    const audit = await management()
      .get('/api/v1/administration/authorization/audit')
      .query({ platform: 'PROVIDER', targetId: created.body.data.id })
      .expect(200);
    expect(
      audit.body.data.items.filter(
        (item: { requestId?: string }) => item.requestId === requestId,
      ).length,
    ).toBeGreaterThan(0);
  });

  it('returns stable errors for duplicate and cross-platform identifiers', async () => {
    const [{ id: administrationPermissionId }] = await dataSource.query<
      { id: string }[]
    >(
      `SELECT id FROM tbl_administration_permission
       WHERE code = 'authorization:role:write'`,
    );
    const role = await management()
      .post('/api/v1/administration/authorization/PROVIDER/roles')
      .send({
        code: 'E2E_DUPLICATE',
        name: 'Duplicate target',
        permissionIds: [],
      })
      .expect(201);

    await management()
      .post('/api/v1/administration/authorization/PROVIDER/roles')
      .send({ code: 'E2E_DUPLICATE', name: 'Duplicate', permissionIds: [] })
      .expect(409)
      .expect(({ body }) => {
        expect(body.code).toBe('AUTHORIZATION_ROLE_CODE_EXISTS');
      });

    await management()
      .put(
        `/api/v1/administration/authorization/PROVIDER/roles/${role.body.data.id}/permissions`,
      )
      .set('X-Lang', 'vi')
      .send({ permissionIds: [administrationPermissionId], expectedVersion: 1 })
      .expect(409)
      .expect(({ body }) => {
        expect(body.code).toBe('AUTHORIZATION_PERMISSION_PLATFORM_MISMATCH');
        expect(body.message).toContain('permission');
        expect(body.details).toBeDefined();
      });

    await management()
      .delete(
        `/api/v1/administration/authorization/PROVIDER/roles/${role.body.data.id}`,
      )
      .expect(200);
  });

  it('does not allow deleting the protected provider OWNER role', async () => {
    const [{ id: ownerId }] = await dataSource.query<{ id: string }[]>(
      `SELECT id FROM tbl_provider_role WHERE code = 'OWNER'`,
    );
    await management()
      .delete(`/api/v1/administration/authorization/PROVIDER/roles/${ownerId}`)
      .expect(409)
      .expect(({ body }) => {
        expect(body.code).toBe('AUTHORIZATION_SYSTEM_ROLE_IMMUTABLE');
      });
  });

  it('returns the role with subjects when listing a role assignment', async () => {
    const [{ id: roleId }] = await dataSource.query<{ id: string }[]>(
      `SELECT id FROM tbl_provider_role WHERE code = 'OWNER'`,
    );

    await management()
      .get(
        `/api/v1/administration/authorization/PROVIDER/roles/${roleId}/subjects`,
      )
      .expect(200)
      .expect(({ body }) => {
        expect(body.data).toEqual(
          expect.objectContaining({
            role: expect.objectContaining({ id: roleId }),
            items: expect.any(Array),
            meta: expect.objectContaining({
              page: expect.any(Number),
              limit: expect.any(Number),
              total: expect.any(Number),
            }),
          }),
        );
      });
  });
});
