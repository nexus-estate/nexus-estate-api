import * as sourceModule from './service.interface';

describe('service interface', () => {
  it('loads as an independent module boundary', () => {
    expect(sourceModule).toBeDefined();
  });
});
