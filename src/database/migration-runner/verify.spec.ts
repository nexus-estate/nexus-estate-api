import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

describe('verify', () => {
  it('keeps the executable entrypoint beside its source', () => {
    expect(existsSync(resolve(__dirname, 'verify.ts'))).toBe(true);
  });
});
