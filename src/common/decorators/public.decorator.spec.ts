import * as sourceModule from './public.decorator';

describe('public decorator', () => {
  it('loads as an independent module boundary', () => {
    expect(sourceModule).toBeDefined();
  });
});
