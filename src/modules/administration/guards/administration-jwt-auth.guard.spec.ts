import * as sourceModule from './administration-jwt-auth.guard';

describe('administration jwt auth guard', () => {
  it('loads as an independent module boundary', () => {
    expect(sourceModule).toBeDefined();
  });
});
