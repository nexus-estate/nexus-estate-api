import * as sourceModule from './provider-profile.service';

describe('provider profile service', () => {
  it('loads as an independent module boundary', () => {
    expect(sourceModule).toBeDefined();
  });
});
