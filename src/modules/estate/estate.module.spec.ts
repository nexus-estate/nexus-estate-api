import * as sourceModule from './estate.module';

describe('estate module', () => {
  it('loads as an independent module boundary', () => {
    expect(sourceModule).toBeDefined();
  });
});
