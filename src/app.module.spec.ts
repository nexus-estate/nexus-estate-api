import { AppModule } from './app.module';

describe('AppModule', () => {
  it('should have the correct module structure', () => {
    expect(AppModule).toBeDefined();
    const moduleMetadata = Reflect.getMetadata('imports', AppModule) as
      unknown[] | undefined;
    expect(moduleMetadata).toBeDefined();
    expect(Array.isArray(moduleMetadata)).toBe(true);
    expect(moduleMetadata!.length).toBeGreaterThanOrEqual(3);
  });

  it('should have UserModule, AuthModule, and RbacModule imported', () => {
    const imports = Reflect.getMetadata('imports', AppModule) as
      unknown[] | undefined;
    const moduleNames = imports!
      .filter((imp: unknown) => typeof imp === 'function')
      .map((imp: unknown) => (imp as { name: string }).name);

    expect(moduleNames).toContain('UserModule');
    expect(moduleNames).toContain('AuthModule');
    expect(moduleNames).toContain('RbacModule');
  });
});
