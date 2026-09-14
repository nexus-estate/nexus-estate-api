import * as sourceModule from './common-error-codes';

describe('common error codes', () => {
  it('loads as an independent module boundary', () => {
    expect(sourceModule).toBeDefined();
  });
});
