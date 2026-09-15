import * as sourceModule from './create-estate-dto';

describe('create estate dto', () => {
  it('loads as an independent module boundary', () => {
    expect(sourceModule).toBeDefined();
  });
});
