import * as sourceModule from './customer.service';

describe('customer service', () => {
  it('loads as an independent module boundary', () => {
    expect(sourceModule).toBeDefined();
  });
});
