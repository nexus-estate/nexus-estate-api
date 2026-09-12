import * as sourceModule from './provider.controller';

describe('provider controller', () => {
  it('loads as an independent module boundary', () => {
    expect(sourceModule).toBeDefined();
  });
});
