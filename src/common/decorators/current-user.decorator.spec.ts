import * as sourceModule from './current-user.decorator';

describe('current user decorator', () => {
  it('loads as an independent module boundary', () => {
    expect(sourceModule).toBeDefined();
  });
});
