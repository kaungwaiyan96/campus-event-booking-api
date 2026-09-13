import dotenv from 'dotenv';
dotenv.config();

export const config = {
  port: Number(process.env.PORT) || 5000,
  nodeEnv: process.env.NODE_ENV || 'development',
  databaseUrl: process.env.DATABASE_URL || '',
  peerApiKey: process.env.PEER_API_KEY || 'campus_events_sec_key_2026',
};

export default config;
