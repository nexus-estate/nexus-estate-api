import * as sourceModule from './repository.interface';

describe('repository interface', () => {
  it('loads as an independent module boundary', () => {
    expect(sourceModule).toBeDefined();
  });
});
