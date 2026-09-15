import { Server } from 'node:http';
import config from './config/env';
import { keyVaultService } from './services/keyVault.service';
import { validateProductionRuntime } from './config/runtimeSecrets';

export interface BootstrapDependencies {
  port: number;
  initializeSecrets: () => Promise<void>;
  loadApp: () => Promise<{ default: { listen: (port: number, callback: () => void) => Server } }>;
  log: (message: string) => void;
}

const defaults: BootstrapDependencies = {
  port: config.port,
  initializeSecrets: () => keyVaultService.initialize(),
  loadApp: () => import('./app'),
  log: console.log,
};

export async function startServer(overrides: Partial<BootstrapDependencies> = {}): Promise<Server> {
  const dependencies = { ...defaults, ...overrides };
  await dependencies.initializeSecrets();
  validateProductionRuntime(config);
  const { default: app } = await dependencies.loadApp();
  return app.listen(dependencies.port, () => dependencies.log(`Server active on port: ${dependencies.port}`));
}
