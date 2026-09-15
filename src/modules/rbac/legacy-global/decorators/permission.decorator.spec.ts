import * as sourceModule from './permission.decorator';

describe('permission decorator', () => {
  it('loads as an independent module boundary', () => {
    expect(sourceModule).toBeDefined();
  });
});
