import * as sourceModule from './province.repo';

describe('province repo', () => {
  it('loads as an independent module boundary', () => {
    expect(sourceModule).toBeDefined();
  });
});
