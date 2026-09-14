import * as sourceModule from './base.entity';

describe('base entity', () => {
  it('loads as an independent module boundary', () => {
    expect(sourceModule).toBeDefined();
  });
});
