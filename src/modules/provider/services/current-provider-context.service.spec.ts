import * as sourceModule from './current-provider-context.service';

describe('current provider context service', () => {
  it('loads as an independent module boundary', () => {
    expect(sourceModule).toBeDefined();
  });
});
