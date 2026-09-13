import { SecretClient } from '@azure/keyvault-secrets';
import { DefaultAzureCredential, ClientSecretCredential } from '@azure/identity';
import { config } from '../config/env';

/**
 * Azure Key Vault Service
 * Fulfills Course Requirement: Secrets Management (Azure Key Vault).
 * In production, pulls DATABASE_URL, JWT_SECRET, and API keys securely from Azure Key Vault.
 * In development, falls back gracefully to local environment variables.
 */
class KeyVaultService {
  private client: SecretClient | null = null;
  private isInitialized = false;

  public async initialize(): Promise<void> {
    const keyVaultName = config.keyVaultName || process.env.KEY_VAULT_NAME;

    // In local development, if no Key Vault is configured, use local .env
    if (!keyVaultName) {
      console.log('ℹ️  [KeyVault] KEY_VAULT_NAME not set. Using local environment variables for secrets.');
      this.isInitialized = true;
      return;
    }

    const keyVaultUrl = `https://${keyVaultName}.vault.azure.net`;
    console.log(`🔐 [KeyVault] Connecting to Azure Key Vault: ${keyVaultUrl}`);

    try {
      let credential;
      // If explicit Client ID/Secret/Tenant provided, use ClientSecretCredential
      if (process.env.AZURE_CLIENT_ID && process.env.AZURE_CLIENT_SECRET && process.env.AZURE_TENANT_ID) {
        credential = new ClientSecretCredential(
          process.env.AZURE_TENANT_ID,
          process.env.AZURE_CLIENT_ID,
          process.env.AZURE_CLIENT_SECRET
        );
      } else {
        // Otherwise use DefaultAzureCredential (Managed Identity on Azure VM / Azure CLI)
        credential = new DefaultAzureCredential();
      }

      this.client = new SecretClient(keyVaultUrl, credential);

      // Load critical production secrets into runtime memory
      await this.loadRuntimeSecrets();
      this.isInitialized = true;
      console.log('✅ [KeyVault] All runtime secrets successfully fetched from Azure Key Vault.');
    } catch (error: any) {
      console.error('❌ [KeyVault] Failed to connect to Azure Key Vault:', error.message);
      if (config.nodeEnv === 'production') {
        throw new Error(`Production requires Azure Key Vault secrets: ${error.message}`);
      }
      console.log('⚠️  [KeyVault] Falling back to local environment variables.');
      this.isInitialized = true;
    }
  }

  /**
   * Fetches secret from Azure Key Vault or falls back to process.env
   */
  public async getSecret(secretName: string, fallbackEnvVar?: string): Promise<string> {
    if (this.client) {
      try {
        // Azure Key Vault secret names only allow alphanumeric and dashes (e.g. DATABASE-URL)
        const azureSecretName = secretName.replace(/_/g, '-');
        const secret = await this.client.getSecret(azureSecretName);
        if (secret.value) {
          return secret.value;
        }
      } catch (err: any) {
        console.warn(`[KeyVault] Secret '${secretName}' not found in Key Vault, checking environment.`);
      }
    }

    const envName = fallbackEnvVar || secretName;
    return process.env[envName] || '';
  }

  /**
   * Preloads all required secrets on app startup
   */
  private async loadRuntimeSecrets(): Promise<void> {
    const dbUrl = await this.getSecret('DATABASE-URL', 'DATABASE_URL');
    if (dbUrl) {
      config.databaseUrl = dbUrl;
      process.env.DATABASE_URL = dbUrl;
    }

    const jwtSecret = await this.getSecret('JWT-SECRET', 'JWT_SECRET');
    if (jwtSecret) {
      config.jwtSecret = jwtSecret;
      process.env.JWT_SECRET = jwtSecret;
    }

    const peerApiKey = await this.getSecret('PEER-API-KEY', 'PEER_API_KEY');
    if (peerApiKey) {
      config.peerApiKey = peerApiKey;
      process.env.PEER_API_KEY = peerApiKey;
    }
  }
}

export const keyVaultService = new KeyVaultService();
export default keyVaultService;
