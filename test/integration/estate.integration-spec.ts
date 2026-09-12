import { Test, type TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  PostgreSqlContainer,
  type StartedPostgreSqlContainer,
} from '@testcontainers/postgresql';
import { DataSource } from 'typeorm';
import { SnakeNamingStrategy } from 'typeorm-naming-strategies';

import { Estate } from '../../src/modules/estate/entities';
import { EstateModule } from '../../src/modules/estate/estate.module';
import { EstateRepo } from '../../src/modules/estate/repositories/estate.repo';
import {
  EstatePurpose,
  EstateType,
  type CreateEstateData,
} from '../../src/modules/estate/type/estate.type';
import {
  PROVINCE_TYPES,
  Province,
  WARD_TYPES,
  Ward,
} from '../../src/modules/location/entities/location.entity';
import { Permission } from '../../src/modules/rbac/entities/permission.entity';
import { RolePermission } from '../../src/modules/rbac/entities/role-permission.entity';
import { Role } from '../../src/modules/rbac/entities/role.entity';
import { CustomerAccount } from '../../src/modules/customer/models/customer-account.entity';

jest.setTimeout(120_000);

describe('EstateRepo (PostgreSQL integration)', () => {
  let container: StartedPostgreSqlContainer;
  let module: TestingModule | undefined;
  let dataSource: DataSource;
  let estateRepository: EstateRepo;
  let owner: CustomerAccount;
  let otherCustomer: CustomerAccount;
  let province: Province;
  let ward: Ward;

  const createData = (): CreateEstateData => ({
    customerId: owner.id,
    title: 'Riverside apartment',
    description: 'River view',
    type: EstateType.APARTMENT,
    purpose: EstatePurpose.SALE,
    price: 3_500_000_000,
    area: 82.5,
    bedrooms: 2,
    bathrooms: 2,
    floors: 20,
    addressLine: '1 Nguyen Hue',
    provinceId: province.id,
    wardId: ward.id,
    latitude: 10.7769,
    longitude: 106.7009,
  });

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
            Estate,
            CustomerAccount,
            Role,
            Permission,
            RolePermission,
            Province,
            Ward,
          ],
          namingStrategy: new SnakeNamingStrategy(),
          synchronize: true,
        }),
        EstateModule,
      ],
    }).compile();

    dataSource = module.get(DataSource);
    estateRepository = module.get(EstateRepo);
  });

  beforeEach(async () => {
    await dataSource.query(
      'TRUNCATE TABLE tbl_estate, tbl_customer_account, tbl_role, tbl_ward, tbl_province CASCADE',
    );

    const role = await dataSource.getRepository(Role).save({
      name: 'customer',
      description: null,
      isSystem: true,
    });
    owner = await dataSource.getRepository(CustomerAccount).save({
      email: 'owner@nexus.test',
      password: 'hashed-password',
      roleId: role.id,
    });
    otherCustomer = await dataSource.getRepository(CustomerAccount).save({
      email: 'other@nexus.test',
      password: 'hashed-password',
      roleId: role.id,
    });
    province = await dataSource.getRepository(Province).save({
      code: '79',
      name: 'Ho Chi Minh City',
      type: PROVINCE_TYPES.MUNICIPALITY,
    });
    ward = await dataSource.getRepository(Ward).save({
      code: '26734',
      name: 'Ben Nghe',
      type: WARD_TYPES.WARD,
      provinceId: province.id,
    });
  });

  afterAll(async () => {
    await module?.close();
    await container?.stop();
  });

  it('persists an estate and returns the saved entity', async () => {
    const created = await estateRepository.createEstate(createData());

    expect(created).toMatchObject({
      id: expect.any(String) as string,
      customerId: owner.id,
      title: 'Riverside apartment',
      provinceId: province.id,
      wardId: ward.id,
    });
  });

  it('finds a non-deleted estate by id with its relations', async () => {
    const created = await estateRepository.createEstate(createData());

    const found = await estateRepository.findById(created.id);

    expect(found).toMatchObject({
      id: created.id,
      customer: { id: owner.id, email: owner.email },
      province: { id: province.id },
      ward: { id: ward.id, provinceId: province.id },
    });
    await dataSource.getRepository(Estate).softDelete(created.id);
    await expect(estateRepository.findById(created.id)).resolves.toBeNull();
  });

  it('finds only non-deleted estates belonging to a user', async () => {
    const visible = await estateRepository.createEstate(createData());
    const deleted = await estateRepository.createEstate({
      ...createData(),
      title: 'Deleted estate',
    });
    await estateRepository.createEstate({
      ...createData(),
      customerId: otherCustomer.id,
      title: 'Other owner estate',
    });
    await dataSource.getRepository(Estate).softDelete(deleted.id);

    const found = await estateRepository.findByCustomerId(owner.id);

    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({ id: visible.id, customerId: owner.id });
  });

  it('updates an existing estate and returns null for a missing id', async () => {
    const created = await estateRepository.createEstate(createData());

    const updated = await estateRepository.updateEstate(created.id, {
      title: 'Updated riverside apartment',
      price: 3_750_000_000,
    });

    expect(updated).toMatchObject({
      id: created.id,
      title: 'Updated riverside apartment',
      price: 3_750_000_000,
    });
    await expect(
      estateRepository.updateEstate('00000000-0000-4000-8000-000000000000', {
        title: 'Missing',
      }),
    ).resolves.toBeNull();
  });

  it('soft-deletes an existing estate and reports no affected missing row', async () => {
    const created = await estateRepository.createEstate(createData());

    await expect(estateRepository.softDeleteEstate(created.id)).resolves.toBe(
      true,
    );
    await expect(
      estateRepository.softDeleteEstate('00000000-0000-4000-8000-000000000000'),
    ).resolves.toBe(false);
    await expect(estateRepository.findById(created.id)).resolves.toBeNull();
  });
});
