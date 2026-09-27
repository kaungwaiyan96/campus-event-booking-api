import test from 'node:test';
import assert from 'node:assert/strict';
import { validateProductionRuntime } from '../src/config/runtimeSecrets';
import { AppConfig } from '../src/config/env';

function productionConfig(overrides: Partial<AppConfig> = {}): AppConfig {
  return {
    port: 5000,
    nodeEnv: 'production',
    databaseUrl: 'postgresql://postgres:secret@postgres:5432/campus_events?schema=public',
    peerApiKey: 'rotated-peer-key',
    jwtSecret: 'rotated-jwt-secret',
    campusCoordinates: { latitude: 13.7563, longitude: 100.5018 },
    keyVaultName: 'campus-events-kv-2474',
    azureAd: {
      clientId: 'd16771d8-2e37-476a-be7c-63f4ed09c819',
      tenantId: 'c1f3dc23-b7f8-48d3-9b5d-2b12f158f01f',
      audience: 'd16771d8-2e37-476a-be7c-63f4ed09c819',
    },
    ...overrides,
  };
}

test('production requires the database, JWT, peer key, vault, and Entra identifiers', () => {
  const config = productionConfig({ databaseUrl: '', jwtSecret: '', peerApiKey: '', keyVaultName: '' });
  config.azureAd = {};

  assert.throws(
    () => validateProductionRuntime(config),
    /DATABASE_URL, JWT_SECRET, PEER_API_KEY, KEY_VAULT_NAME, AZURE_AD_CLIENT_ID, AZURE_AD_TENANT_ID, AZURE_AD_AUDIENCE/
  );
});

test('development permits local fallback configuration', () => {
  assert.doesNotThrow(() => validateProductionRuntime(productionConfig({
    nodeEnv: 'development', databaseUrl: '', jwtSecret: '', peerApiKey: '', keyVaultName: '',
  })));
});
