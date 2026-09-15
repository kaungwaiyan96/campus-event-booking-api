import { startServer } from './bootstrap';

const serverPromise = startServer().catch((error): never => {
  console.error('Fatal error during application startup:', error);
  process.exit(1);
});

export default serverPromise;
