import type { StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { PostgreSqlContainer } from '@testcontainers/postgresql';
import { DataSource } from 'typeorm';
import { SnakeNamingStrategy } from 'typeorm-naming-strategies';

import { CustomerAccount } from '../../src/modules/customer/account/entities/customer-account.entity';
import { CustomerAccountRepository } from '../../src/modules/customer/account/repositories/customer-account.repository';
import { CustomerAccountService } from '../../src/modules/customer/account/services/customer-account.service';
import { ProviderAccount } from '../../src/modules/provider/account/entities/provider-account.entity';
import { ProviderAccountRepository } from '../../src/modules/provider/account/repositories/provider-account.repository';
import { ProviderContextResolver } from '../../src/modules/provider/account/services/provider-context.resolver';
import { ProviderAccountService } from '../../src/modules/provider/account/services/provider-account.service';
import { ProviderAccountCommandService } from '../../src/modules/provider/account/services/provider-account-command.service';
import { ProviderAccountPolicy } from '../../src/modules/provider/account/helpers/provider-account.policy';
import { ProviderRegistrationAdministrationService } from '../../src/modules/administration/provider-review/services/provider-registration-administration.service';
import { ProviderSupplyAccessPolicy } from '../../src/modules/provider/authorization/helpers/provider-supply-access.policy';
import { ProviderAuthorizationService } from '../../src/modules/provider/authorization/services/provider-authorization.service';
import { ProviderMembership } from '../../src/modules/provider/authorization/entities/provider-membership.entity';
import { ProviderMembershipRole } from '../../src/modules/provider/authorization/entities/provider-membership-role.entity';
import { ProviderPermission } from '../../src/modules/provider/authorization/entities/provider-permission.entity';
import { ProviderRole } from '../../src/modules/provider/authorization/entities/provider-role.entity';
import { ProviderRolePermission } from '../../src/modules/provider/authorization/entities/provider-role-permission.entity';
import { PROVIDER_PERMISSION_REGISTRY } from '../../src/modules/provider/authorization/permissions/provider-permission.registry';
import {
  ProviderStatus,
  ProviderType,
  ProviderVerificationStatus,
} from '../../src/modules/provider/account/enums/account.enums';
import { ProviderAccountErrorCodes } from '../../src/modules/provider/account/errors/provider-account-error-codes';
import { BackfillProviderSupplyReadPermissions1790063077456 } from '../../src/modules/provider/authorization/migrations/1790063077456-BackfillProviderSupplyReadPermissions';

jest.setTimeout(120_000);

describe('Provider context and supply access (PostgreSQL integration)', () => {
  let container: StartedPostgreSqlContainer;
  let dataSource: DataSource;
  let resolver: ProviderContextResolver;
  let supplyAccessPolicy: ProviderSupplyAccessPolicy;
  let adminService: ProviderRegistrationAdministrationService;
  let commandService: ProviderAccountCommandService;

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

    const accountRepository = new ProviderAccountRepository(dataSource);
    const authorizationService = new ProviderAuthorizationService(dataSource);
    resolver = new ProviderContextResolver(accountRepository, dataSource);
    supplyAccessPolicy = new ProviderSupplyAccessPolicy(
      new ProviderAccountPolicy(),
      authorizationService,
    );
    commandService = new ProviderAccountCommandService(
      dataSource,
      accountRepository,
      authorizationService,
    );
    adminService = new ProviderRegistrationAdministrationService(
      new CustomerAccountService(new CustomerAccountRepository(dataSource)),
      accountRepository,
      new ProviderAccountService(accountRepository, resolver),
      commandService,
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
    const permissions = await dataSource.getRepository(ProviderPermission).save(
      PROVIDER_PERMISSION_REGISTRY.map((permission) => ({
        code: permission.code,
        name: permission.name,
        description: permission.description,
        category: permission.category,
        resource: permission.resource,
        action: permission.action,
        riskLevel: permission.riskLevel,
        isAssignable: permission.isAssignable,
        deprecatedAt: null,
      })),
    );
    await dataSource.getRepository(ProviderRolePermission).save(
      permissions.map((permission) => ({
        roleId: ownerRole.id,
        permissionId: permission.id,
      })),
    );

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
    it('grants the explicitly mapped supply permission to an active verified OWNER', async () => {
      const context = await resolver.resolve(owner.id, providerA.id);
      const effective = await new ProviderAuthorizationService(
        dataSource,
      ).effective(context);

      expect(() => supplyAccessPolicy.requireReadAccess(context)).not.toThrow();
      expect(effective.permissions.map(({ code }) => code)).toEqual(
        expect.arrayContaining([
          'property:read',
          'property:create',
          'property:update',
          'property:archive',
          'listing:read',
          'listing:create',
          'listing:publish',
          'listing:archive',
        ]),
      );
      await expect(
        supplyAccessPolicy.requirePermission(context, 'property:create'),
      ).resolves.toBeUndefined();
    });

    it('rejects an active membership with a missing supply permission', async () => {
      const context = await resolver.resolve(owner.id, providerE.id);

      expect(() => supplyAccessPolicy.requireReadAccess(context)).not.toThrow();
      await expect(
        supplyAccessPolicy.requirePermission(context, 'property:create'),
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
        supplyAccessPolicy.requirePermission(context, 'property:create'),
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
        supplyAccessPolicy.requirePermission(context, 'property:create'),
      ).rejects.toMatchObject({
        errorCode: ProviderAccountErrorCodes.PROVIDER_ACCOUNT_SUSPENDED.code,
      });
    });

    it('honors permission revocation on the next request', async () => {
      const context = await resolver.resolve(owner.id, providerA.id);
      await expect(
        supplyAccessPolicy.requirePermission(context, 'property:create'),
      ).resolves.toBeUndefined();

      await dataSource.query(
        `DELETE FROM tbl_provider_role_permission
         WHERE role_id = $1
           AND permission_id = (SELECT id FROM tbl_provider_permission WHERE code = 'property:create')`,
        [ownerRole.id],
      );

      await expect(
        supplyAccessPolicy.requirePermission(context, 'property:create'),
      ).rejects.toMatchObject({
        errorCode: ProviderAccountErrorCodes.PROVIDER_ACCOUNT_FORBIDDEN.code,
      });
    });

    it('backfills valid non-owner readers without changing custom mappings', async () => {
      const createPermission = await dataSource
        .getRepository(ProviderPermission)
        .findOneByOrFail({ code: 'property:create' });
      await dataSource.getRepository(ProviderRolePermission).save({
        roleId: agentRole.id,
        permissionId: createPermission.id,
      });

      const migration =
        new BackfillProviderSupplyReadPermissions1790063077456();
      const runner = dataSource.createQueryRunner();
      await migration.up(runner);

      const context = await resolver.resolve(owner.id, providerE.id);
      const effective = await new ProviderAuthorizationService(
        dataSource,
      ).effective(context);
      expect(effective.permissions.map(({ code }) => code)).toEqual(
        expect.arrayContaining([
          'property:read',
          'listing:read',
          'property:create',
        ]),
      );

      await migration.down(runner);
      const remaining = await new ProviderAuthorizationService(
        dataSource,
      ).effective(context);
      expect(remaining.permissions.map(({ code }) => code)).toContain(
        'property:create',
      );
      expect(remaining.permissions.map(({ code }) => code)).not.toEqual(
        expect.arrayContaining(['property:read', 'listing:read']),
      );
      await runner.release();
    });
  });

  describe('admin approve read-after-write regression', () => {
    it('approves a pending provider owned by a multi-membership customer without ambiguity', async () => {
      // The customer is already an active member of another customer's provider
      // and owns a pending provider, so context selection without a provider id
      // is ambiguous. This mirrors the pre-fix regression exactly.
      const multi = await createCustomer('multi@nexus.test');
      const providerX = await createProvider(third.id);
      const membershipX = await createMembership(providerX.id, multi.id);
      await assignRole(membershipX.id, ownerRole.id);

      const pendingProviderId = await commandService.createPending(multi.id, {
        type: ProviderType.INDIVIDUAL,
        displayName: 'Pending Provider',
      });

      await expect(resolver.resolve(multi.id)).rejects.toMatchObject({
        errorCode: ProviderAccountErrorCodes.PROVIDER_CONTEXT_REQUIRED.code,
      });

      const response = await adminService.approve(pendingProviderId);

      expect(response.customerId).toBe(multi.id);
      expect(response.role).toBe('customer');
      expect(response.providerAccount.id).toBe(pendingProviderId);

      const approved = await accounts().findOneByOrFail({
        id: pendingProviderId,
      });
      expect(approved.verificationStatus).toBe(
        ProviderVerificationStatus.VERIFIED,
      );
    });
  });
});
