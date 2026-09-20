import type { StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { PostgreSqlContainer } from '@testcontainers/postgresql';
import { DataSource } from 'typeorm';
import { SnakeNamingStrategy } from 'typeorm-naming-strategies';

import { CustomerAccount } from '../../src/modules/customer/account/entities/customer-account.entity';
import { ProviderAccount } from '../../src/modules/provider/account/entities/provider-account.entity';
import { ProviderAccountRepository } from '../../src/modules/provider/account/repositories/provider-account.repository';
import { ProviderContextResolver } from '../../src/modules/provider/account/services/provider-context.resolver';
import { ProviderAccountPolicy } from '../../src/modules/provider/account/helpers/provider-account.policy';
import { ProviderSupplyAccessPolicy } from '../../src/modules/provider/authorization/helpers/provider-supply-access.policy';
import { ProviderAuthorizationService } from '../../src/modules/provider/authorization/services/provider-authorization.service';
import { ProviderMembership } from '../../src/modules/provider/authorization/entities/provider-membership.entity';
import { ProviderMembershipRole } from '../../src/modules/provider/authorization/entities/provider-membership-role.entity';
import { ProviderPermission } from '../../src/modules/provider/authorization/entities/provider-permission.entity';
import { ProviderRole } from '../../src/modules/provider/authorization/entities/provider-role.entity';
import { ProviderRolePermission } from '../../src/modules/provider/authorization/entities/provider-role-permission.entity';
import {
  ProviderStatus,
  ProviderType,
  ProviderVerificationStatus,
} from '../../src/modules/provider/account/enums/account.enums';
import { ProviderAccountErrorCodes } from '../../src/modules/provider/account/errors/provider-account-error-codes';

jest.setTimeout(120_000);

describe('Provider context and supply access (PostgreSQL integration)', () => {
  let container: StartedPostgreSqlContainer;
  let dataSource: DataSource;
  let resolver: ProviderContextResolver;
  let supplyAccessPolicy: ProviderSupplyAccessPolicy;

  let owner: CustomerAccount;
  let other: CustomerAccount;
  let third: CustomerAccount;
  let providerA: ProviderAccount;
  let providerE: ProviderAccount;
  let ownerRole: ProviderRole;
  let agentRole: ProviderRole;

  const accounts = () => dataSource.getRepository(ProviderAccount);
  const memberships = () => dataSource.getRepository(ProviderMembership);
  const roleAssignments = () =>
    dataSource.getRepository(ProviderMembershipRole);

  const createCustomer = (email: string) =>
    dataSource.getRepository(CustomerAccount).save({ email, password: 'x' });

  const createProvider = (
    ownerCustomerId: string,
    overrides: Partial<ProviderAccount> = {},
  ) =>
    accounts().save({
      ownerCustomerId,
      type: ProviderType.INDIVIDUAL,
      displayName: 'Provider',
      status: ProviderStatus.ACTIVE,
      verificationStatus: ProviderVerificationStatus.VERIFIED,
      ...overrides,
    });

  const createMembership = (
    providerId: string,
    customerId: string,
    status: 'ACTIVE' | 'SUSPENDED' | 'REMOVED' = 'ACTIVE',
  ) => memberships().save({ providerId, customerId, status });

  const assignRole = (membershipId: string, roleId: string) =>
    roleAssignments().save({ membershipId, roleId });

  beforeAll(async () => {
    container = await new PostgreSqlContainer('postgres:18-alpine')
      .withDatabase('nexus_estate_provider_context_test')
      .withUsername('test')
      .withPassword('test')
      .start();

    dataSource = new DataSource({
      type: 'postgres',
      host: container.getHost(),
      port: container.getPort(),
      username: container.getUsername(),
      password: container.getPassword(),
      database: container.getDatabase(),
      entities: [
        CustomerAccount,
        ProviderAccount,
        ProviderMembership,
        ProviderMembershipRole,
        ProviderRole,
        ProviderPermission,
        ProviderRolePermission,
      ],
      namingStrategy: new SnakeNamingStrategy(),
      synchronize: true,
    });
    await dataSource.initialize();

    resolver = new ProviderContextResolver(
      new ProviderAccountRepository(dataSource),
      dataSource,
    );
    supplyAccessPolicy = new ProviderSupplyAccessPolicy(
      new ProviderAccountPolicy(),
      new ProviderAuthorizationService(dataSource),
    );
  });

  afterAll(async () => {
    await dataSource?.destroy();
    await container?.stop();
  });

  beforeEach(async () => {
    await dataSource.query(
      `TRUNCATE TABLE tbl_provider_membership_role,
         tbl_provider_role_permission,
         tbl_provider_membership,
         tbl_provider_account,
         tbl_customer_account,
         tbl_provider_role,
         tbl_provider_permission
       CASCADE`,
    );

    ownerRole = await dataSource.getRepository(ProviderRole).save({
      code: 'OWNER',
      name: 'Owner',
      description: null,
      isSystem: true,
    });
    agentRole = await dataSource.getRepository(ProviderRole).save({
      code: 'AGENT',
      name: 'Agent',
      description: null,
      isSystem: true,
    });

    owner = await createCustomer('owner@nexus.test');
    other = await createCustomer('other@nexus.test');
    third = await createCustomer('third@nexus.test');

    providerA = await createProvider(owner.id);
    const ownerMembership = await createMembership(providerA.id, owner.id);
    await assignRole(ownerMembership.id, ownerRole.id);

    // The owner is an AGENT (not OWNER) on a provider owned by another customer.
    providerE = await createProvider(other.id);
    const agentMembership = await createMembership(providerE.id, owner.id);
    await assignRole(agentMembership.id, agentRole.id);
  });

  describe('ProviderContextResolver', () => {
    it('resolves the exact active membership and provider state by providerId', async () => {
      const context = await resolver.resolve(owner.id, providerA.id);

      expect(context).toMatchObject({
        customerId: owner.id,
        providerId: providerA.id,
        providerType: ProviderType.INDIVIDUAL,
        providerStatus: ProviderStatus.ACTIVE,
        verificationStatus: ProviderVerificationStatus.VERIFIED,
        membershipStatus: 'ACTIVE',
      });
      expect(context.membershipId).toEqual(expect.any(String));
    });

    it('resolves the sole active membership without an explicit providerId', async () => {
      const soleCustomer = await createCustomer('sole@nexus.test');
      const providerS = await createProvider(soleCustomer.id);
      await createMembership(providerS.id, soleCustomer.id);

      await expect(resolver.resolve(soleCustomer.id)).resolves.toMatchObject({
        providerId: providerS.id,
        membershipStatus: 'ACTIVE',
      });
    });

    it('rejects ambiguous multi-membership context with one canonical error', async () => {
      await expect(resolver.resolve(owner.id)).rejects.toMatchObject({
        errorCode: ProviderAccountErrorCodes.PROVIDER_CONTEXT_REQUIRED.code,
      });
    });

    it('rejects a provider the customer has no active membership on', async () => {
      const providerC = await createProvider(third.id);

      await expect(
        resolver.resolve(owner.id, providerC.id),
      ).rejects.toMatchObject({
        errorCode: ProviderAccountErrorCodes.PROVIDER_ACCOUNT_FORBIDDEN.code,
      });
    });

    it('ignores non-active memberships', async () => {
      const inactiveCustomer = await createCustomer('inactive@nexus.test');
      const providerI = await createProvider(inactiveCustomer.id);
      await createMembership(providerI.id, inactiveCustomer.id, 'SUSPENDED');

      await expect(resolver.resolve(inactiveCustomer.id)).rejects.toMatchObject(
        {
          errorCode: ProviderAccountErrorCodes.PROVIDER_ACCOUNT_NOT_FOUND.code,
        },
      );
      await expect(
        resolver.resolve(inactiveCustomer.id, providerI.id),
      ).rejects.toMatchObject({
        errorCode: ProviderAccountErrorCodes.PROVIDER_ACCOUNT_FORBIDDEN.code,
      });
    });

    it('ignores soft-deleted providers', async () => {
      const deletedCustomer = await createCustomer('deleted@nexus.test');
      const providerD = await createProvider(deletedCustomer.id);
      await createMembership(providerD.id, deletedCustomer.id);
      await accounts().softDelete(providerD.id);

      await expect(resolver.resolve(deletedCustomer.id)).rejects.toMatchObject({
        errorCode: ProviderAccountErrorCodes.PROVIDER_ACCOUNT_NOT_FOUND.code,
      });
      await expect(
        resolver.resolve(deletedCustomer.id, providerD.id),
      ).rejects.toMatchObject({
        errorCode: ProviderAccountErrorCodes.PROVIDER_ACCOUNT_FORBIDDEN.code,
      });
    });

    it('rejects an invalid provider identifier without querying memberships', async () => {
      await expect(
        resolver.resolve(owner.id, 'not-a-uuid'),
      ).rejects.toMatchObject({
        errorCode: ProviderAccountErrorCodes.PROVIDER_ACCOUNT_FORBIDDEN.code,
      });
    });
  });

  describe('ProviderSupplyAccessPolicy', () => {
    it('grants read and write access to an active verified OWNER', async () => {
      const context = await resolver.resolve(owner.id, providerA.id);

      expect(() => supplyAccessPolicy.requireReadAccess(context)).not.toThrow();
      await expect(
        supplyAccessPolicy.requireWriteAccess(context),
      ).resolves.toBeUndefined();
    });

    it('rejects write access when the membership lacks the OWNER role', async () => {
      const context = await resolver.resolve(owner.id, providerE.id);

      expect(() => supplyAccessPolicy.requireReadAccess(context)).not.toThrow();
      await expect(
        supplyAccessPolicy.requireWriteAccess(context),
      ).rejects.toMatchObject({
        errorCode: ProviderAccountErrorCodes.PROVIDER_ACCOUNT_FORBIDDEN.code,
      });
    });

    it('rejects reads and writes for an unverified provider', async () => {
      await accounts().update(providerA.id, {
        verificationStatus: ProviderVerificationStatus.PENDING,
      });
      const context = await resolver.resolve(owner.id, providerA.id);

      expect(() => supplyAccessPolicy.requireReadAccess(context)).toThrow();
      await expect(
        supplyAccessPolicy.requireWriteAccess(context),
      ).rejects.toMatchObject({
        errorCode: ProviderAccountErrorCodes.PROVIDER_ACCOUNT_NOT_VERIFIED.code,
      });
    });

    it('rejects reads and writes for a suspended provider', async () => {
      await accounts().update(providerA.id, {
        status: ProviderStatus.SUSPENDED,
      });
      const context = await resolver.resolve(owner.id, providerA.id);

      expect(() => supplyAccessPolicy.requireReadAccess(context)).toThrow();
      await expect(
        supplyAccessPolicy.requireWriteAccess(context),
      ).rejects.toMatchObject({
        errorCode: ProviderAccountErrorCodes.PROVIDER_ACCOUNT_SUSPENDED.code,
      });
    });
  });
});
