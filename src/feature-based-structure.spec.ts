import { existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const modulesRoot = join(__dirname, 'modules');
const technicalLayerNames = new Set([
  'controllers',
  'services',
  'repositories',
  'models',
  'entities',
  'dto',
  'guards',
  'strategies',
  'helpers',
  'enums',
  'type',
  'types',
  'errors',
  'decorators',
  'constants',
  'permissions',
]);
const lifecycleDirectoryNames = new Set(['migrations', 'data-migrations']);

function filesUnder(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = join(directory, entry.name);
    return entry.isDirectory() ? filesUnder(entryPath) : [entryPath];
  });
}

describe('feature-based module structure', () => {
  it('keeps module roots free of technical layer directories', () => {
    const violations: string[] = [];

    for (const moduleEntry of readdirSync(modulesRoot, {
      withFileTypes: true,
    })) {
      if (!moduleEntry.isDirectory()) continue;

      const modulePath = join(modulesRoot, moduleEntry.name);
      for (const child of readdirSync(modulePath, { withFileTypes: true })) {
        if (child.isDirectory() && technicalLayerNames.has(child.name)) {
          violations.push(`${moduleEntry.name}/${child.name}`);
        }
      }
    }

    expect(violations).toEqual([]);
  });

  it('allows only module composition files at a module root', () => {
    const violations: string[] = [];

    for (const moduleEntry of readdirSync(modulesRoot, {
      withFileTypes: true,
    })) {
      if (!moduleEntry.isDirectory()) continue;

      for (const child of readdirSync(join(modulesRoot, moduleEntry.name), {
        withFileTypes: true,
      })) {
        if (
          child.isFile() &&
          child.name.endsWith('.ts') &&
          !child.name.endsWith('.module.ts') &&
          !child.name.endsWith('.module.spec.ts')
        ) {
          violations.push(`${moduleEntry.name}/${child.name}`);
        }
      }
    }

    expect(violations).toEqual([]);
  });

  it('keeps feature roots focused on composition and layer directories', () => {
    const violations: string[] = [];

    for (const moduleEntry of readdirSync(modulesRoot, {
      withFileTypes: true,
    })) {
      if (!moduleEntry.isDirectory()) continue;

      const modulePath = join(modulesRoot, moduleEntry.name);
      for (const featureEntry of readdirSync(modulePath, {
        withFileTypes: true,
      })) {
        if (!featureEntry.isDirectory()) continue;

        for (const child of readdirSync(join(modulePath, featureEntry.name), {
          withFileTypes: true,
        })) {
          if (
            child.isDirectory() &&
            !technicalLayerNames.has(child.name) &&
            !lifecycleDirectoryNames.has(child.name)
          ) {
            violations.push(
              `${moduleEntry.name}/${featureEntry.name}/${child.name}`,
            );
          }

          if (
            child.isFile() &&
            child.name.endsWith('.ts') &&
            !child.name.endsWith('.module.ts') &&
            !child.name.endsWith('.module.spec.ts')
          ) {
            violations.push(
              `${moduleEntry.name}/${featureEntry.name}/${child.name}`,
            );
          }
        }
      }
    }

    expect(violations).toEqual([]);
  });

  it('keeps a colocated sidecar for every feature source file', () => {
    const missing: string[] = [];

    for (const moduleEntry of readdirSync(modulesRoot, {
      withFileTypes: true,
    })) {
      if (!moduleEntry.isDirectory()) continue;

      const modulePath = join(modulesRoot, moduleEntry.name);
      for (const sourceFile of filesUnder(modulePath)) {
        if (
          !sourceFile.endsWith('.ts') ||
          /\.(spec|test)\.ts$/.test(sourceFile)
        ) {
          continue;
        }

        const stem = sourceFile.slice(0, -3);
        const sidecars = [`${stem}.spec.ts`, `${stem}.test.ts`].filter(
          (sidecar) => existsSync(sidecar) && statSync(sidecar).isFile(),
        );

        if (sidecars.length !== 1) missing.push(sourceFile);
      }
    }

    expect(missing).toEqual([]);
  });
});
