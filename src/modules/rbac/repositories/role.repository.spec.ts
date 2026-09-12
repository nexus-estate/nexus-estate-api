import * as sourceModule from './role.repository';

describe('role repository', () => {
  it('loads as an independent module boundary', () => {
    expect(sourceModule).toBeDefined();
  });
});
