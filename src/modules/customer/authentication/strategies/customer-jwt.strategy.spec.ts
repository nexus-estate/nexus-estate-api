import * as sourceModule from './customer-jwt.strategy';

describe('customer jwt strategy', () => {
  it('loads as an independent module boundary', () => {
    expect(sourceModule).toBeDefined();
  });
});
