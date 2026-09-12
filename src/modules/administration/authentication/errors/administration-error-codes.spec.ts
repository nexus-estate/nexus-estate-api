import * as sourceModule from './administration-error-codes';

describe('administration error codes', () => {
  it('loads as an independent module boundary', () => {
    expect(sourceModule).toBeDefined();
  });
});
