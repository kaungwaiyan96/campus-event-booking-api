import app from './app';
import { config } from './config/env';

const server = app.listen(config.port, () => {
  console.log(`====================================================`);
  console.log(` Campus Event Management & Booking API`);
  console.log(` Server active on port: ${config.port}`);
  console.log(` Base path: http://localhost:${config.port}/events-api/v1`);
  console.log(` Environment: ${config.nodeEnv}`);
  console.log(`====================================================`);
});

export default server;
