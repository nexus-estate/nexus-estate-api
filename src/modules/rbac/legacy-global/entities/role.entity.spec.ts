import * as sourceModule from './role.entity';

describe('role entity', () => {
  it('loads as an independent module boundary', () => {
    expect(sourceModule).toBeDefined();
  });
});
