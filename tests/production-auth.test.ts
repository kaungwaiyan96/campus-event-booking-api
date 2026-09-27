import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';

test('production does not expose the development token route', () => {
  const script = `
    process.env.NODE_ENV = 'production';
    process.env.DATABASE_URL = 'postgresql://unused:unused@localhost:5432/unused';
    process.env.JWT_SECRET = 'test-only';
    process.env.PEER_API_KEY = 'test-only';
    process.env.KEY_VAULT_NAME = 'test-vault';
    process.env.AZURE_AD_CLIENT_ID = 'd16771d8-2e37-476a-be7c-63f4ed09c819';
    process.env.AZURE_AD_TENANT_ID = 'c1f3dc23-b7f8-48d3-9b5d-2b12f158f01f';
    process.env.AZURE_AD_AUDIENCE = 'd16771d8-2e37-476a-be7c-63f4ed09c819';
    const http = require('node:http');
    const app = require('./src/app').default;
    const server = http.createServer(app).listen(0, async () => {
      const port = server.address().port;
      const response = await fetch('http://127.0.0.1:' + port + '/events-api/v1/auth/dev-token', { method: 'POST' });
      server.close(() => process.exit(response.status === 404 ? 0 : 2));
    });
  `;
  const result = spawnSync(process.execPath, ['--require', 'ts-node/register', '-e', script], {
    cwd: process.cwd(), encoding: 'utf8', timeout: 10_000,
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
});
