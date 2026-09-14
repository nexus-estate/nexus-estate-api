import * as sourceModule from './logging.interceptor';

describe('logging interceptor', () => {
  it('loads as an independent module boundary', () => {
    expect(sourceModule).toBeDefined();
  });
});
