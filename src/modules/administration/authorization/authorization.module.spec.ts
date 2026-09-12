import 'reflect-metadata';
import { AuthorizationManagementController } from './controllers/authorization-management.controller';
import { ProviderMembershipAuthorizationController } from './controllers/provider-membership-authorization.controller';
import { AdministrationAuthorizationModule } from './authorization.module';

describe('AdministrationAuthorizationModule', () => {
  it('owns the management and provider-membership controllers', () => {
    const controllers = Reflect.getMetadata(
      'controllers',
      AdministrationAuthorizationModule,
    ) as unknown[];
    expect(controllers).toEqual(
      expect.arrayContaining([
        AuthorizationManagementController,
        ProviderMembershipAuthorizationController,
      ]),
    );
  });

  it('does not depend on the legacy global RBAC module', () => {
    const imports = Reflect.getMetadata(
      'imports',
      AdministrationAuthorizationModule,
    ) as unknown[];
    expect(imports).not.toContain(
      expect.objectContaining({ name: 'RbacModule' }),
    );
  });
});
