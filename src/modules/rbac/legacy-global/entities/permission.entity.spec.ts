import * as sourceModule from './permission.entity';

describe('permission entity', () => {
  it('loads as an independent module boundary', () => {
    expect(sourceModule).toBeDefined();
  });
});
