import { AppModule } from './app.module';
import { BuyerModule } from './modules/buyer/buyer.module';

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
    expect(moduleNames).toContain('BuyerModule');
    expect(moduleNames).toContain('AdministrationModule');
  });

  it('should provide buyer boundaries through BuyerModule', () => {
    const imports = Reflect.getMetadata('imports', BuyerModule) as
      unknown[] | undefined;
    const moduleNames = imports!
      .filter((imp: unknown) => typeof imp === 'function')
      .map((imp: unknown) => (imp as { name: string }).name);

    expect(moduleNames).toContain('BuyerAccountModule');
    expect(moduleNames).toContain('BuyerAuthenticationModule');
  });
});
