import * as sourceModule from './customer-jwt-auth.guard';

describe('customer jwt auth guard', () => {
  it('loads as an independent module boundary', () => {
    expect(sourceModule).toBeDefined();
  });
});
