import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

test('production Compose renders without publishing PostgreSQL', () => {
  const directory = mkdtempSync(join(tmpdir(), 'campus-compose-'));
  const passwordFile = join(directory, 'postgres-password');
  writeFileSync(passwordFile, 'test-password\n', { mode: 0o600 });

  const result = spawnSync('docker', ['compose', '-f', 'docker-compose.production.yml', 'config', '--format', 'json'], {
    cwd: process.cwd(), encoding: 'utf8',
    env: {
      ...process.env,
      POSTGRES_PASSWORD_FILE: passwordFile,
      KEY_VAULT_NAME: 'campus-events-kv-2474',
      AZURE_AD_CLIENT_ID: 'd16771d8-2e37-476a-be7c-63f4ed09c819',
      AZURE_AD_TENANT_ID: 'c1f3dc23-b7f8-48d3-9b5d-2b12f158f01f',
      AZURE_AD_AUDIENCE: 'd16771d8-2e37-476a-be7c-63f4ed09c819',
    },
  });
  assert.equal(result.status, 0, result.stderr);
  const compose = JSON.parse(result.stdout);
  assert.equal(compose.services.postgres.ports, undefined);
  assert.equal(compose.services.api.ports[0].host_ip, '127.0.0.1');
  assert.equal(compose.services.api.environment.DATABASE_URL, undefined);
  assert.equal(compose.services.api.environment.JWT_SECRET, undefined);
  assert.equal(compose.services.api.environment.PEER_API_KEY, undefined);
});

for (const script of ['scripts/deploy.sh', 'scripts/start-production.sh', 'scripts/configure-nginx.sh']) {
  test(`${script} has valid Bash syntax`, () => {
    const result = spawnSync('bash', ['-n', script], { cwd: process.cwd(), encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
  });

  test(`${script} documents its required arguments`, () => {
    const result = spawnSync('bash', [script, '--help'], { cwd: process.cwd(), encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /Usage:/);
  });
}
