import app from './app';
import { config } from './config/env';
import { keyVaultService } from './services/keyVault.service';

async function bootstrap() {
  try {
    // 1. Initialize runtime secrets from Azure Key Vault (Production) or local .env (Dev)
    await keyVaultService.initialize();

    // 2. Start HTTP Server
    const server = app.listen(config.port, () => {
      console.log(`====================================================`);
      console.log(` Campus Event Management & Booking API`);
      console.log(` Server active on port: ${config.port}`);
      console.log(` Base path: http://localhost:${config.port}/events-api/v1`);
      console.log(` Environment: ${config.nodeEnv}`);
      console.log(` Azure Key Vault: ${config.keyVaultName ? 'Enabled (' + config.keyVaultName + ')' : 'Local Env Mode'}`);
      console.log(`====================================================`);
    });

    return server;
  } catch (error) {
    console.error('Fatal error during application startup:', error);
    process.exit(1);
  }
}

const serverPromise = bootstrap();
export default serverPromise;
