import * as sourceModule from './roles.decorator';

describe('roles decorator', () => {
  it('loads as an independent module boundary', () => {
    expect(sourceModule).toBeDefined();
  });
});
