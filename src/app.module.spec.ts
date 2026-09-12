import { AppModule } from './app.module';
import { CustomerModule } from './modules/customer/customer.module';

describe('AppModule', () => {
  it('should have the correct module structure', () => {
    expect(AppModule).toBeDefined();
    const moduleMetadata = Reflect.getMetadata('imports', AppModule) as
      unknown[] | undefined;
    expect(moduleMetadata).toBeDefined();
    expect(Array.isArray(moduleMetadata)).toBe(true);
    expect(moduleMetadata!.length).toBeGreaterThanOrEqual(3);
  });

  it('should import the modules enabled by the local application', () => {
    const imports = Reflect.getMetadata('imports', AppModule) as
      unknown[] | undefined;
    const moduleNames = imports!
      .filter((imp: unknown) => typeof imp === 'function')
      .map((imp: unknown) => (imp as { name: string }).name);

    expect(moduleNames).toContain('CommonModule');
    expect(moduleNames).toContain('LocationModule');
    expect(moduleNames).toContain('CustomerModule');
    expect(moduleNames).toContain('AdministrationModule');
  });

  it('should provide customer boundaries through CustomerModule', () => {
    const imports = Reflect.getMetadata('imports', CustomerModule) as
      unknown[] | undefined;
    const moduleNames = imports!
      .filter((imp: unknown) => typeof imp === 'function')
      .map((imp: unknown) => (imp as { name: string }).name);

    expect(moduleNames).toContain('CommonModule');
    expect(moduleNames).not.toContain('RbacModule');
    const controllers = Reflect.getMetadata('controllers', CustomerModule) as
      unknown[] | undefined;
    expect(
      controllers?.map((controller) => (controller as { name: string }).name),
    ).toEqual(
      expect.arrayContaining([
        'CustomerController',
        'CustomerAuthenticationController',
      ]),
    );
  });
});
