import * as sourceModule from './customer-account.entity';

describe('customer account entity', () => {
  it('loads as an independent module boundary', () => {
    expect(sourceModule).toBeDefined();
  });
});
