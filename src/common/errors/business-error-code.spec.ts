import * as sourceModule from './business-error-code';

describe('business error code', () => {
  it('loads as an independent module boundary', () => {
    expect(sourceModule).toBeDefined();
  });
});
