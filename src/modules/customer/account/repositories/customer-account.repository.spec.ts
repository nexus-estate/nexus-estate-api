import * as sourceModule from './customer-account.repository';

describe('customer account repository', () => {
  it('loads as an independent module boundary', () => {
    expect(sourceModule).toBeDefined();
  });
});
