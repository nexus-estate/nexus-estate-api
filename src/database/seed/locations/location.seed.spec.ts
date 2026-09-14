import * as sourceModule from './location.seed';

describe('location seed', () => {
  it('loads as an independent module boundary', () => {
    expect(sourceModule).toBeDefined();
  });
});
