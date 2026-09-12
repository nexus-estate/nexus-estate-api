import * as sourceModule from './base.repository';

describe('base repository', () => {
  it('loads as an independent module boundary', () => {
    expect(sourceModule).toBeDefined();
  });
});
