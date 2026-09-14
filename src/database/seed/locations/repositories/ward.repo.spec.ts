import * as sourceModule from './ward.repo';

describe('ward repo', () => {
  it('loads as an independent module boundary', () => {
    expect(sourceModule).toBeDefined();
  });
});
