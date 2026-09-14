import * as sourceModule from './provider.module';

describe('provider module', () => {
  it('loads as an independent module boundary', () => {
    expect(sourceModule).toBeDefined();
  });
});
