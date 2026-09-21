import { readFileSync, readdirSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

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
  'management',
  'marketplace',
  'provider',
  'administration',
  'audit',
  'context',
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

  it('requires every schema migration to be module-owned and date-stamped', () => {
    const invalid: string[] = [];
    const sourceRoot = join(__dirname);
    const migrationFiles = filesUnder(sourceRoot).filter(
      (file) =>
        file.includes(`${sep}migrations${sep}`) &&
        file.endsWith('.ts') &&
        !/\.(spec|test)\.ts$/.test(file),
    );

    for (const migrationFile of migrationFiles) {
      const relativePath = relative(sourceRoot, migrationFile);
      const isModuleOwned = relativePath.startsWith(`modules${sep}`);
      const fileName = relativePath.split(sep).pop() ?? '';
      const match = /^(\d{13})-[A-Za-z][A-Za-z0-9]*\.ts$/.exec(fileName);
      const timestamp = match ? Number(match[1]) : Number.NaN;
      const isDateStamped =
        Number.isSafeInteger(timestamp) &&
        timestamp >= Date.UTC(2000, 0, 1) &&
        timestamp <= Date.UTC(2100, 0, 1);
      const hasMatchingClassTimestamp = Boolean(
        match &&
        new RegExp(`export class [A-Za-z0-9_]+${match[1]}\\b`).test(
          readFileSync(migrationFile, 'utf8'),
        ),
      );

      if (
        !isModuleOwned ||
        !match ||
        !isDateStamped ||
        !hasMatchingClassTimestamp
      ) {
        invalid.push(relativePath);
      }
    }

    expect(invalid).toEqual([]);
  });
});
