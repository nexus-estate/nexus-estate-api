import * as sourceModule from './base-query-builder';

describe('base query builder', () => {
  it('loads as an independent module boundary', () => {
    expect(sourceModule).toBeDefined();
  });
});
