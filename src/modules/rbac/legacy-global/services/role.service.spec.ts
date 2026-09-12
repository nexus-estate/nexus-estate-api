import * as sourceModule from './role.service';

describe('role service', () => {
  it('loads as an independent module boundary', () => {
    expect(sourceModule).toBeDefined();
  });
});
