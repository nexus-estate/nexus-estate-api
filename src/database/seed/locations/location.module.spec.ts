import * as sourceModule from './location.module';

describe('location module', () => {
  it('loads as an independent module boundary', () => {
    expect(sourceModule).toBeDefined();
  });
});
