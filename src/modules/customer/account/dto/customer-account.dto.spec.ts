import * as sourceModule from './customer-account.dto';

describe('customer account dto', () => {
  it('loads as an independent module boundary', () => {
    expect(sourceModule).toBeDefined();
  });
});
