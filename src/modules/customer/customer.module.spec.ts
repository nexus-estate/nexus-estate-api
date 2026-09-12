import * as sourceModule from './customer.module';

describe('customer module', () => {
  it('loads as an independent module boundary', () => {
    expect(sourceModule).toBeDefined();
  });
});
