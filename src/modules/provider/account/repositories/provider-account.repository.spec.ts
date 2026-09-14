import * as sourceModule from './provider-account.repository';

describe('provider account repository', () => {
  it('loads as an independent module boundary', () => {
    expect(sourceModule).toBeDefined();
  });
});
