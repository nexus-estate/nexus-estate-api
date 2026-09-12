import * as sourceModule from './customer.controller';

describe('customer controller', () => {
  it('loads as an independent module boundary', () => {
    expect(sourceModule).toBeDefined();
  });
});
