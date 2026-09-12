import * as sourceModule from './administration.module';

describe('administration module', () => {
  it('loads as an independent module boundary', () => {
    expect(sourceModule).toBeDefined();
  });
});
