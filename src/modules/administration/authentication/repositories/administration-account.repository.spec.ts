import * as sourceModule from './administration-account.repository';

describe('administration account repository', () => {
  it('loads as an independent module boundary', () => {
    expect(sourceModule).toBeDefined();
  });
});
