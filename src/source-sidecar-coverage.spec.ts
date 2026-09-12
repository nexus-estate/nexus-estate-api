import { existsSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(entryPath);
    return entry.isFile() && entry.name.endsWith('.ts') ? [entryPath] : [];
  });
}

describe('mandatory colocated TypeScript sidecar tests', () => {
  it('protects every production source file under src', () => {
    const srcDirectory = path.resolve(__dirname);
    const invalid = sourceFiles(srcDirectory)
      .filter(
        (file) =>
          !file.endsWith('.spec.ts') &&
          !file.endsWith('.test.ts') &&
          !file.endsWith('.d.ts'),
      )
      .filter((file) => {
        const stem = file.slice(0, -'.ts'.length);
        const sidecars = [`${stem}.spec.ts`, `${stem}.test.ts`].filter(
          (sidecar) => existsSync(sidecar),
        );
        return sidecars.length !== 1;
      })
      .map((file) => path.relative(srcDirectory, file));

    expect(invalid).toEqual([]);
  });

  it('does not treat directories as source files', () => {
    expect(statSync(path.resolve(__dirname)).isDirectory()).toBe(true);
  });
});
