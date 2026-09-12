import * as sourceModule from './permission.repository';

describe('permission repository', () => {
  it('loads as an independent module boundary', () => {
    expect(sourceModule).toBeDefined();
  });
});
