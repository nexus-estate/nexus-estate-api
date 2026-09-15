import * as sourceModule from './permission.constant';

describe('permission constant', () => {
  it('loads as an independent module boundary', () => {
    expect(sourceModule).toBeDefined();
  });
});
