import { Test, type TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  PostgreSqlContainer,
  type StartedPostgreSqlContainer,
} from '@testcontainers/postgresql';
import { DataSource, QueryFailedError } from 'typeorm';
import { SnakeNamingStrategy } from 'typeorm-naming-strategies';

import { Permission } from '../../src/modules/rbac/entities/permission.entity';
import { RolePermission } from '../../src/modules/rbac/entities/role-permission.entity';
import { Role } from '../../src/modules/rbac/entities/role.entity';
import { BuyerAccount } from '../../src/modules/buyer/account/models/buyer-account.entity';
import { SellerAccount } from '../../src/modules/seller-platform/account/models/account.entity';
import { SellerAccountModule } from '../../src/modules/seller-platform/account/account.module';
import { SellerAccountRepository } from '../../src/modules/seller-platform/account/repositories/account.repository';
import {
  SellerStatus,
  SellerType,
  SellerVerificationStatus,
} from '../../src/modules/seller-platform/account/enums/account.enums';

jest.setTimeout(120_000);

describe('SellerAccountRepository (PostgreSQL integration)', () => {
  let container: StartedPostgreSqlContainer;
  let module: TestingModule | undefined;
  let dataSource: DataSource;
  let repository: SellerAccountRepository;
  let user: BuyerAccount;

  beforeAll(async () => {
    container = await new PostgreSqlContainer('postgres:18-alpine')
      .withDatabase('nexus_estate_test')
      .withUsername('test')
      .withPassword('test')
      .start();

    module = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot({
          type: 'postgres',
          host: container.getHost(),
          port: container.getPort(),
          username: container.getUsername(),
          password: container.getPassword(),
          database: container.getDatabase(),
          entities: [
            SellerAccount,
            BuyerAccount,
            Role,
            Permission,
            RolePermission,
          ],
          namingStrategy: new SnakeNamingStrategy(),
          synchronize: true,
        }),
        SellerAccountModule,
      ],
    }).compile();

    dataSource = module.get(DataSource);
    repository = module.get(SellerAccountRepository);
  });

  beforeEach(async () => {
    await dataSource.query(
      'TRUNCATE TABLE tbl_seller_account, tbl_buyer_account, tbl_role CASCADE',
    );

    const role = await dataSource.getRepository(Role).save({
      name: 'buyer',
      isSystem: true,
    });
    user = await dataSource.getRepository(BuyerAccount).save({
      email: 'seller@nexus.test',
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
      ownerBuyerId: user.id,
      type: SellerType.INDIVIDUAL,
      displayName: 'Seller',
      status: SellerStatus.ACTIVE,
      verificationStatus: SellerVerificationStatus.UNVERIFIED,
    });

    const found = await repository.findByOwnerBuyerId(user.id);
    expect(found).toMatchObject({
      id: created.id,
      ownerBuyerId: user.id,
      type: SellerType.INDIVIDUAL,
    });
    expect(found?.createdAt).toBeInstanceOf(Date);
    expect(found?.updatedAt).toBeInstanceOf(Date);
  });

  it('enforces one account per owner and the owner foreign key', async () => {
    await repository.create({
      ownerBuyerId: user.id,
      type: SellerType.BROKER,
      displayName: 'Broker',
    });

    await expect(
      repository.create({
        ownerBuyerId: user.id,
        type: SellerType.AGENCY,
        displayName: 'Agency',
      }),
    ).rejects.toBeInstanceOf(QueryFailedError);

    await expect(
      repository.create({
        ownerBuyerId: '00000000-0000-4000-8000-000000000099',
        type: SellerType.INDIVIDUAL,
        displayName: 'Orphan',
      }),
    ).rejects.toBeInstanceOf(QueryFailedError);
  });
});
