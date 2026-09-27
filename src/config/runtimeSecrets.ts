import { AppConfig } from './env';

export function validateProductionRuntime(config: AppConfig): void {
  if (config.nodeEnv !== 'production') return;

  const missing = [
    ['DATABASE_URL', config.databaseUrl],
    ['JWT_SECRET', config.jwtSecret],
    ['PEER_API_KEY', config.peerApiKey],
    ['KEY_VAULT_NAME', config.keyVaultName],
    ['AZURE_AD_CLIENT_ID', config.azureAd.clientId],
    ['AZURE_AD_TENANT_ID', config.azureAd.tenantId],
    ['AZURE_AD_AUDIENCE', config.azureAd.audience],
  ].filter(([, value]) => !value).map(([name]) => name);

  if (missing.length > 0) {
    throw new Error(`Missing required production configuration: ${missing.join(', ')}`);
  }
}
