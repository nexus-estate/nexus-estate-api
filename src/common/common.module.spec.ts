import * as sourceModule from './common.module';

describe('common module', () => {
  it('loads as an independent module boundary', () => {
    expect(sourceModule).toBeDefined();
  });
});
