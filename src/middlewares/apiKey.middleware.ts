import { Request, Response, NextFunction } from 'express';
import { config } from '../config/env';

export function apiKeyMiddleware(req: Request, res: Response, next: NextFunction) {
  const key = req.headers['x-api-key'];
  if (typeof key !== 'string' || !key || !config.peerApiKey || key !== config.peerApiKey) {
    res.status(401).json({
      success: false,
      error: { code: 'UNAUTHORIZED', message: 'Invalid or missing API key.' },
    });
    return;
  }
  next();
}
