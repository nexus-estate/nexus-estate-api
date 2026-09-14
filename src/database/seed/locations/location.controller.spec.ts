import * as sourceModule from './location.controller';

describe('location controller', () => {
  it('loads as an independent module boundary', () => {
    expect(sourceModule).toBeDefined();
  });
});
