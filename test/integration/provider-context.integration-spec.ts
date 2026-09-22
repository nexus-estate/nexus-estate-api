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
import { AddProviderSupplyPermissions1790058166348 } from '../../src/modules/provider/authorization/migrations/1790058166348-AddProviderSupplyPermissions';

jest.setTimeout(120_000);

type BookkeepingState = {
  role_backfill_exists: boolean;
  permission_backfill_exists: boolean;
  assignment_backfill_exists: boolean;
};

type PermissionCodeRow = { code: string };

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

      const migration = new AddProviderSupplyPermissions1790058166348();
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

    it('gives valid roleless legacy memberships explicit read-only MEMBER access', async () => {
      const customPermission = await dataSource
        .getRepository(ProviderPermission)
        .findOneByOrFail({ code: 'property:create' });
      await dataSource.getRepository(ProviderRolePermission).save({
        roleId: agentRole.id,
        permissionId: customPermission.id,
      });
      const legacyCustomer = await createCustomer('legacy-reader@nexus.test');
      const legacyProvider = await createProvider(legacyCustomer.id);
      await createMembership(legacyProvider.id, legacyCustomer.id);

      const migration = new AddProviderSupplyPermissions1790058166348();
      const runner = dataSource.createQueryRunner();
      await migration.up(runner);

      const context = await resolver.resolve(
        legacyCustomer.id,
        legacyProvider.id,
      );
      const effective = await new ProviderAuthorizationService(
        dataSource,
      ).effective(context);
      const permissionCodes = effective.permissions.map(({ code }) => code);

      expect(permissionCodes).toEqual(
        expect.arrayContaining(['property:read', 'listing:read']),
      );
      expect(permissionCodes).not.toEqual(
        expect.arrayContaining([
          'property:create',
          'property:update',
          'property:archive',
          'listing:create',
          'listing:publish',
          'listing:archive',
        ]),
      );

      await migration.down(runner);
      const afterRollback = await new ProviderAuthorizationService(
        dataSource,
      ).effective(context);
      expect(afterRollback.permissions.map(({ code }) => code)).not.toEqual(
        expect.arrayContaining(['property:read', 'listing:read']),
      );
      await expect(
        dataSource.getRepository(ProviderRolePermission).findOneByOrFail({
          roleId: agentRole.id,
          permissionId: customPermission.id,
        }),
      ).resolves.toBeDefined();
      await runner.release();
    });

    it('supports a clean rollback followed by a deterministic redeploy', async () => {
      const legacyCustomer = await createCustomer('redeploy-reader@nexus.test');
      const legacyProvider = await createProvider(legacyCustomer.id);
      await createMembership(legacyProvider.id, legacyCustomer.id);

      const migration = new AddProviderSupplyPermissions1790058166348();
      const runner = dataSource.createQueryRunner();
      await migration.up(runner);

      await expect(
        dataSource.getRepository(ProviderRole).findOneBy({ code: 'MEMBER' }),
      ).resolves.toBeDefined();

      await migration.down(runner);

      await expect(
        dataSource.getRepository(ProviderRole).findOneBy({ code: 'MEMBER' }),
      ).resolves.toBeNull();
      const bookkeepingStateAfterRollback = await dataSource.query<
        BookkeepingState[]
      >(`
        SELECT
          to_regclass('public.tbl_provider_supply_member_role_backfill') IS NOT NULL AS role_backfill_exists,
          to_regclass('public.tbl_provider_supply_member_permission_backfill') IS NOT NULL AS permission_backfill_exists,
          to_regclass('public.tbl_provider_supply_member_assignment_backfill') IS NOT NULL AS assignment_backfill_exists
      `);
      expect(bookkeepingStateAfterRollback[0]).toEqual({
        role_backfill_exists: false,
        permission_backfill_exists: false,
        assignment_backfill_exists: false,
      });

      await migration.up(runner);
      const context = await resolver.resolve(
        legacyCustomer.id,
        legacyProvider.id,
      );
      const effective = await new ProviderAuthorizationService(
        dataSource,
      ).effective(context);
      expect(effective.permissions.map(({ code }) => code)).toEqual(
        expect.arrayContaining(['property:read', 'listing:read']),
      );

      await migration.down(runner);
      await runner.release();
    });

    it('refuses rollback when MEMBER has a runtime-owned membership assignment', async () => {
      const legacyCustomer = await createCustomer(
        'runtime-assignment-reader@nexus.test',
      );
      const legacyProvider = await createProvider(legacyCustomer.id);
      const legacyMembership = await createMembership(
        legacyProvider.id,
        legacyCustomer.id,
      );

      const migration = new AddProviderSupplyPermissions1790058166348();
      const runner = dataSource.createQueryRunner();
      await migration.up(runner);
      const memberRole = await dataSource
        .getRepository(ProviderRole)
        .findOneByOrFail({ code: 'MEMBER' });

      const runtimeCustomer = await createCustomer(
        'runtime-assignment@nexus.test',
      );
      const runtimeProvider = await createProvider(runtimeCustomer.id);
      const runtimeMembership = await createMembership(
        runtimeProvider.id,
        runtimeCustomer.id,
      );
      await assignRole(runtimeMembership.id, memberRole.id);

      await expect(migration.down(runner)).rejects.toThrow(
        /runtime-owned membership assignments/,
      );

      await expect(
        dataSource.getRepository(ProviderRole).findOneByOrFail({
          id: memberRole.id,
        }),
      ).resolves.toMatchObject({ code: 'MEMBER' });
      await expect(
        roleAssignments().findOneBy({
          membershipId: legacyMembership.id,
          roleId: memberRole.id,
        }),
      ).resolves.toBeDefined();
      await expect(
        roleAssignments().findOneBy({
          membershipId: runtimeMembership.id,
          roleId: memberRole.id,
        }),
      ).resolves.toBeDefined();

      const permissionCodes = await dataSource.query<PermissionCodeRow[]>(
        `
          SELECT permission.code
          FROM tbl_provider_role_permission mapping
          INNER JOIN tbl_provider_permission permission
            ON permission.id = mapping.permission_id
          WHERE mapping.role_id = $1
        `,
        [memberRole.id],
      );
      expect(permissionCodes.map(({ code }) => code)).toEqual(
        expect.arrayContaining(['property:read', 'listing:read']),
      );
      const bookkeepingState = await dataSource.query<BookkeepingState[]>(`
        SELECT
          to_regclass('public.tbl_provider_supply_member_role_backfill') IS NOT NULL AS role_backfill_exists,
          to_regclass('public.tbl_provider_supply_member_permission_backfill') IS NOT NULL AS permission_backfill_exists,
          to_regclass('public.tbl_provider_supply_member_assignment_backfill') IS NOT NULL AS assignment_backfill_exists
      `);
      expect(bookkeepingState[0]).toEqual({
        role_backfill_exists: true,
        permission_backfill_exists: true,
        assignment_backfill_exists: true,
      });

      await roleAssignments().delete({
        membershipId: runtimeMembership.id,
        roleId: memberRole.id,
      });
      await migration.down(runner);
      await runner.release();
    });

    it('refuses rollback when MEMBER has a runtime-owned permission mapping', async () => {
      const legacyCustomer = await createCustomer(
        'runtime-permission-reader@nexus.test',
      );
      const legacyProvider = await createProvider(legacyCustomer.id);
      const legacyMembership = await createMembership(
        legacyProvider.id,
        legacyCustomer.id,
      );

      const migration = new AddProviderSupplyPermissions1790058166348();
      const runner = dataSource.createQueryRunner();
      await migration.up(runner);
      const memberRole = await dataSource
        .getRepository(ProviderRole)
        .findOneByOrFail({ code: 'MEMBER' });
      const customPermission = await dataSource
        .getRepository(ProviderPermission)
        .findOneByOrFail({ code: 'property:create' });
      await dataSource.getRepository(ProviderRolePermission).save({
        roleId: memberRole.id,
        permissionId: customPermission.id,
      });

      await expect(migration.down(runner)).rejects.toThrow(
        /runtime-owned permission mappings/,
      );

      await expect(
        dataSource.getRepository(ProviderRolePermission).findOneBy({
          roleId: memberRole.id,
          permissionId: customPermission.id,
        }),
      ).resolves.toBeDefined();
      await expect(
        roleAssignments().findOneBy({
          membershipId: legacyMembership.id,
          roleId: memberRole.id,
        }),
      ).resolves.toBeDefined();
      await expect(
        dataSource.getRepository(ProviderRole).findOneBy({ id: memberRole.id }),
      ).resolves.toMatchObject({ code: 'MEMBER' });

      await dataSource.getRepository(ProviderRolePermission).delete({
        roleId: memberRole.id,
        permissionId: customPermission.id,
      });
      await migration.down(runner);
      await runner.release();
    });

    it('fails safely when a custom MEMBER role already exists', async () => {
      const customPermission = await dataSource
        .getRepository(ProviderPermission)
        .findOneByOrFail({ code: 'property:create' });
      const customMemberRole = await dataSource
        .getRepository(ProviderRole)
        .save({
          code: 'MEMBER',
          name: 'Existing custom member',
          description: 'Runtime-managed custom role',
          isSystem: false,
          status: 'ACTIVE',
        });
      await dataSource.getRepository(ProviderRolePermission).save({
        roleId: customMemberRole.id,
        permissionId: customPermission.id,
      });

      const legacyCustomer = await createCustomer(
        'member-collision@nexus.test',
      );
      const legacyProvider = await createProvider(legacyCustomer.id);
      const membership = await createMembership(
        legacyProvider.id,
        legacyCustomer.id,
      );
      await assignRole(membership.id, customMemberRole.id);

      const migration = new AddProviderSupplyPermissions1790058166348();
      const runner = dataSource.createQueryRunner();

      await expect(migration.up(runner)).rejects.toThrow(
        /not owned by this migration/,
      );

      await expect(
        dataSource.getRepository(ProviderRole).findOneByOrFail({
          id: customMemberRole.id,
        }),
      ).resolves.toMatchObject({
        code: 'MEMBER',
        name: 'Existing custom member',
        description: 'Runtime-managed custom role',
        isSystem: false,
        status: 'ACTIVE',
      });
      await expect(
        dataSource.getRepository(ProviderRolePermission).findOneByOrFail({
          roleId: customMemberRole.id,
          permissionId: customPermission.id,
        }),
      ).resolves.toBeDefined();
      await expect(
        dataSource.getRepository(ProviderMembershipRole).findOneByOrFail({
          membershipId: membership.id,
          roleId: customMemberRole.id,
        }),
      ).resolves.toBeDefined();

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
