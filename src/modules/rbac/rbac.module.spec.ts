import * as sourceModule from './rbac.module';

describe('rbac module', () => {
  it('loads as an independent module boundary', () => {
    expect(sourceModule).toBeDefined();
  });
});
