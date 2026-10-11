import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

describe('SeaweedFS bucket bootstrap command', () => {
  let directory: string;
  let command: string;

  beforeAll(() => {
    // Exercise the actual Compose command without needing a running daemon.
    const config = JSON.parse(
      execFileSync(
        'docker',
        [
          'compose',
          '--env-file',
          '.env.example',
          'config',
          '--format',
          'json',
          '--no-env-resolution',
        ],
        { cwd: resolve(__dirname, '../..'), encoding: 'utf8' },
      ),
    ) as { services: { 'seaweedfs-init': { command: string[] } } };
    command = config.services['seaweedfs-init'].command[0].replaceAll(
      '$$',
      '$',
    );
  });

  beforeEach(() => {
    directory = mkdtempSync(join(tmpdir(), 'nexus-seaweedfs-init-'));
    writeFileSync(
      join(directory, 'aws'),
      `#!/bin/sh
set -eu
printf '%s\\n' "$*" >> "$BOOTSTRAP_TEST_DIR/calls"
case "$*" in
  *'s3api head-bucket'*)
    if [ -f "$BOOTSTRAP_TEST_DIR/bucket" ] && [ "$FAIL_VERIFY" != 1 ]; then
      exit 0
    fi
    exit 1
    ;;
  *'s3api create-bucket'*)
    if [ "$FAIL_CREATE" = 1 ]; then exit 1; fi
    touch "$BOOTSTRAP_TEST_DIR/bucket"
    ;;
  *) exit 2 ;;
esac
`,
      { mode: 0o755 },
    );
  });

  afterEach(() => {
    rmSync(directory, { recursive: true, force: true });
  });

  function run(environment: Record<string, string> = {}) {
    return spawnSync('/bin/sh', ['-c', command], {
      encoding: 'utf8',
      env: {
        ...process.env,
        PATH: `${directory}:${process.env.PATH ?? ''}`,
        S3_BUCKET: 'estate-images',
        FAIL_CREATE: '0',
        FAIL_VERIFY: '0',
        BOOTSTRAP_TEST_DIR: directory,
        ...environment,
      },
    });
  }

  function calls(): string[] {
    return readFileSync(join(directory, 'calls'), 'utf8').trim().split('\n');
  }

  it('creates a missing bucket and verifies it through the SeaweedFS endpoint', () => {
    expect(run().status).toBe(0);
    expect(calls()).toEqual([
      '--endpoint-url http://seaweedfs:8333 s3api head-bucket --bucket estate-images',
      '--endpoint-url http://seaweedfs:8333 s3api create-bucket --bucket estate-images',
      '--endpoint-url http://seaweedfs:8333 s3api head-bucket --bucket estate-images',
    ]);
    // A repeat startup must succeed without another create request.
    expect(run().status).toBe(0);
    expect(
      calls().filter((call) => call.includes('create-bucket')),
    ).toHaveLength(1);
  });

  it('preserves an existing bucket', () => {
    writeFileSync(join(directory, 'bucket'), 'existing');
    expect(run().status).toBe(0);
    expect(calls().every((call) => call.includes('head-bucket'))).toBe(true);
    expect(readFileSync(join(directory, 'bucket'), 'utf8')).toBe('existing');
  });

  it('fails startup when bucket creation fails', () => {
    expect(run({ FAIL_CREATE: '1' }).status).toBe(1);
    expect(calls()).toHaveLength(2);
  });

  it('fails startup when the created bucket cannot be verified', () => {
    expect(run({ FAIL_VERIFY: '1' }).status).toBe(1);
    expect(calls()).toHaveLength(3);
  });
});
