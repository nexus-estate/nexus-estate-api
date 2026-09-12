import * as sourceModule from './auth.types';

describe('auth types', () => {
  it('loads as an independent module boundary', () => {
    expect(sourceModule).toBeDefined();
  });
});
