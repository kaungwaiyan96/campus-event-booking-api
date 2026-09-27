import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';

function runChild(script: string): void {
  const result = spawnSync(process.execPath, ['--require', 'ts-node/register', '-e', script], {
    cwd: process.cwd(),
    encoding: 'utf8',
    timeout: 10_000,
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
}

test('development config without Entra IDs uses the development JWKS fallback', () => {
  runChild(`
    const assert = require('node:assert/strict');
    process.env.NODE_ENV = 'development';
    process.env.AZURE_AD_CLIENT_ID = '';
    process.env.AZURE_AD_TENANT_ID = '';
    process.env.AZURE_AD_AUDIENCE = '';
    const jwksPath = require.resolve('jwks-rsa');
    require(jwksPath);
    let jwksOptions;
    require.cache[jwksPath].exports = (options) => {
      jwksOptions = options;
      return { getSigningKey: () => undefined };
    };
    require('./src/middlewares/auth.middleware');
    assert.equal(
      jwksOptions.jwksUri,
      'https://login.microsoftonline.com/common/discovery/v2.0/keys'
    );
  `);
});

test('Entra token verification passes tenant issuer, audience, and RS256 to jwt.verify', () => {
  runChild(`
    const assert = require('node:assert/strict');
    process.env.NODE_ENV = 'production';
    process.env.DATABASE_URL = 'postgresql://unused:unused@localhost:5432/unused';
    process.env.JWT_SECRET = 'test-only';
    process.env.PEER_API_KEY = 'test-only';
    process.env.KEY_VAULT_NAME = 'test-vault';
    process.env.AZURE_AD_CLIENT_ID = 'd16771d8-2e37-476a-be7c-63f4ed09c819';
    process.env.AZURE_AD_TENANT_ID = 'c1f3dc23-b7f8-48d3-9b5d-2b12f158f01f';
    process.env.AZURE_AD_AUDIENCE = 'd16771d8-2e37-476a-be7c-63f4ed09c819';

    const jwksPath = require.resolve('jwks-rsa');
    require(jwksPath);
    require.cache[jwksPath].exports = () => ({ getSigningKey: () => undefined });

    const jwt = require('jsonwebtoken');
    let entraOptions;
    jwt.verify = (token, key, options, callback) => {
      if (typeof key === 'string') throw new Error('not an internal token');
      entraOptions = options;
      callback(null, {
        oid: 'test-oid', name: 'Test User', email: 'test@example.edu', roles: ['STUDENT'],
      });
    };

    const prisma = require('./src/config/prisma').default;
    prisma.user.findFirst = async () => ({
      id: 'test-user', adOid: 'test-oid', name: 'Test User', email: 'test@example.edu', role: 'STUDENT',
    });

    const { authMiddleware } = require('./src/middlewares/auth.middleware');
    (async () => {
      let nextError;
      await authMiddleware({ headers: { authorization: 'Bearer entra-token' } }, {}, (error) => {
        nextError = error;
      });
      assert.equal(nextError, undefined);
      assert.deepEqual(entraOptions, {
        algorithms: ['RS256'],
        audience: 'd16771d8-2e37-476a-be7c-63f4ed09c819',
        issuer: 'https://login.microsoftonline.com/c1f3dc23-b7f8-48d3-9b5d-2b12f158f01f/v2.0',
      });
    })().catch((error) => {
      console.error(error);
      process.exit(1);
    });
  `);
});
