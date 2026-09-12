import * as sourceModule from './administration-jwt.strategy';

describe('administration jwt strategy', () => {
  it('loads as an independent module boundary', () => {
    expect(sourceModule).toBeDefined();
  });
});
