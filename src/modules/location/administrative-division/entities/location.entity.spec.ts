import * as sourceModule from './location.entity';

describe('location entity', () => {
  it('loads as an independent module boundary', () => {
    expect(sourceModule).toBeDefined();
  });
});
