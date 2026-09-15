import { Test, type TestingModule } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  PostgreSqlContainer,
  type StartedPostgreSqlContainer,
} from '@testcontainers/postgresql';
import { DataSource, QueryFailedError } from 'typeorm';
import { SnakeNamingStrategy } from 'typeorm-naming-strategies';

import { Permission } from '../../src/modules/rbac/legacy-global/entities/permission.entity';
import { RolePermission } from '../../src/modules/rbac/legacy-global/entities/role-permission.entity';
import { Role } from '../../src/modules/rbac/legacy-global/entities/role.entity';
import { CustomerAccount } from '../../src/modules/customer/account/entities/customer-account.entity';
import { ProviderAccount } from '../../src/modules/provider/account/entities/provider-account.entity';
import { ProviderModule } from '../../src/modules/provider/provider.module';
import { ProviderAccountRepository } from '../../src/modules/provider/account/repositories/provider-account.repository';
import {
  ProviderStatus,
  ProviderType,
  ProviderVerificationStatus,
} from '../../src/modules/provider/account/enums/account.enums';

jest.setTimeout(120_000);

describe('ProviderAccountRepository (PostgreSQL integration)', () => {
  let container: StartedPostgreSqlContainer;
  let module: TestingModule | undefined;
  let dataSource: DataSource;
  let repository: ProviderAccountRepository;
  let user: CustomerAccount;

  beforeAll(async () => {
    container = await new PostgreSqlContainer('postgres:18-alpine')
      .withDatabase('nexus_estate_test')
      .withUsername('test')
      .withPassword('test')
      .start();

    module = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          load: [() => ({ JWT_SECRET: 'provider-integration-secret' })],
        }),
        TypeOrmModule.forRoot({
          type: 'postgres',
          host: container.getHost(),
          port: container.getPort(),
          username: container.getUsername(),
          password: container.getPassword(),
          database: container.getDatabase(),
          entities: [
            ProviderAccount,
            CustomerAccount,
            Role,
            Permission,
            RolePermission,
          ],
          namingStrategy: new SnakeNamingStrategy(),
          synchronize: true,
        }),
        ProviderModule,
      ],
    }).compile();

    dataSource = module.get(DataSource);
    repository = module.get(ProviderAccountRepository);
  });

  beforeEach(async () => {
    await dataSource.query(
      'TRUNCATE TABLE tbl_provider_account, tbl_customer_account, tbl_role CASCADE',
    );

    const role = await dataSource.getRepository(Role).save({
      name: 'customer',
      isSystem: true,
    });
    user = await dataSource.getRepository(CustomerAccount).save({
      email: 'provider@nexus.test',
      password: 'not-used',
      roleId: role.id,
    });
  });

  afterAll(async () => {
    await module?.close();
    await container?.stop();
  });

  it('inserts and finds an account by owner', async () => {
    const created = await repository.create({
      ownerCustomerId: user.id,
      type: ProviderType.INDIVIDUAL,
      displayName: 'Provider',
      status: ProviderStatus.ACTIVE,
      verificationStatus: ProviderVerificationStatus.UNVERIFIED,
    });

    const found = await repository.findByOwnerCustomerId(user.id);
    expect(found).toMatchObject({
      id: created.id,
      ownerCustomerId: user.id,
      type: ProviderType.INDIVIDUAL,
    });
    expect(found?.createdAt).toBeInstanceOf(Date);
    expect(found?.updatedAt).toBeInstanceOf(Date);
  });

  it('enforces one account per owner and the owner foreign key', async () => {
    await repository.create({
      ownerCustomerId: user.id,
      type: ProviderType.BROKER,
      displayName: 'Broker',
    });

    await expect(
      repository.create({
        ownerCustomerId: user.id,
        type: ProviderType.AGENCY,
        displayName: 'Agency',
      }),
    ).rejects.toBeInstanceOf(QueryFailedError);

    await expect(
      repository.create({
        ownerCustomerId: '00000000-0000-4000-8000-000000000099',
        type: ProviderType.INDIVIDUAL,
        displayName: 'Orphan',
      }),
    ).rejects.toBeInstanceOf(QueryFailedError);
  });
});
