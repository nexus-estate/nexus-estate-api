import * as sourceModule from './role-permission.repository';

describe('role permission repository', () => {
  it('loads as an independent module boundary', () => {
    expect(sourceModule).toBeDefined();
  });
});
