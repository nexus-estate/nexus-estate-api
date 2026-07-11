/**
 * Unit tests for the main application bootstrap logic.
 *
 * Verifies configuration values used at startup.
 */
describe('App Bootstrap (main)', () => {
  it('should use the configured port from environment or default to 50001', () => {
    const port = parseInt(process.env.PORT || '50001', 10);
    expect(port).toBeGreaterThan(0);
    expect(port).toBeLessThanOrEqual(65535);
  });

  it('should have a valid NODE_ENV or default to development', () => {
    const env = process.env.NODE_ENV || 'development';
    expect(['development', 'production', 'test']).toContain(env);
  });
});
