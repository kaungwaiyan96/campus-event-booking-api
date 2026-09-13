import dotenv from 'dotenv';
dotenv.config();

export interface AppConfig {
  port: number;
  nodeEnv: string;
  databaseUrl: string;
  peerApiKey: string;
  jwtSecret: string;
  keyVaultName?: string;
  azureAd: {
    clientId?: string;
    tenantId?: string;
    audience?: string;
  };
}

export const config: AppConfig = {
  port: Number(process.env.PORT) || 5000,
  nodeEnv: process.env.NODE_ENV || 'development',
  databaseUrl: process.env.DATABASE_URL || '',
  peerApiKey: process.env.PEER_API_KEY || 'campus_events_sec_key_2026',
  jwtSecret: process.env.JWT_SECRET || 'super_secret_campus_jwt_key_2026',
  keyVaultName: process.env.KEY_VAULT_NAME,
  azureAd: {
    clientId: process.env.AZURE_AD_CLIENT_ID,
    tenantId: process.env.AZURE_AD_TENANT_ID,
    audience: process.env.AZURE_AD_AUDIENCE || process.env.AZURE_AD_CLIENT_ID,
  },
};

export default config;
