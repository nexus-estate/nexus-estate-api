import * as sourceModule from './location.dto';

describe('location dto', () => {
  it('loads as an independent module boundary', () => {
    expect(sourceModule).toBeDefined();
  });
});
