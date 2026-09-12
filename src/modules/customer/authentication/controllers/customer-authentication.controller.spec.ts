import * as sourceModule from './customer-authentication.controller';

describe('customer authentication controller', () => {
  it('loads as an independent module boundary', () => {
    expect(sourceModule).toBeDefined();
  });
});
