import * as sourceModule from './customer-account.type';

describe('customer account type', () => {
  it('loads as an independent module boundary', () => {
    expect(sourceModule).toBeDefined();
  });
});
