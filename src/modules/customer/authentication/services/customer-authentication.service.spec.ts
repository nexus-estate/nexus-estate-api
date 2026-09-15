import * as sourceModule from './customer-authentication.service';

describe('customer authentication service', () => {
  it('loads as an independent module boundary', () => {
    expect(sourceModule).toBeDefined();
  });
});
