import * as sourceModule from './account.enums';

describe('account enums', () => {
  it('loads as an independent module boundary', () => {
    expect(sourceModule).toBeDefined();
  });
});
