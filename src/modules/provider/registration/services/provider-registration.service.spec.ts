import * as sourceModule from './provider-registration.service';

describe('provider registration service', () => {
  it('loads as an independent module boundary', () => {
    expect(sourceModule).toBeDefined();
  });
});
