import * as sourceModule from './http-codes';

describe('http codes', () => {
  it('loads as an independent module boundary', () => {
    expect(sourceModule).toBeDefined();
  });
});
