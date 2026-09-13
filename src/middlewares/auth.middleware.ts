import { Request, Response, NextFunction } from 'express';
import { Role } from '@prisma/client';
import prisma from '../config/prisma';
import { AppError } from './error.middleware';
import config from '../config/env';

export interface AuthUser {
  id: string;
  adOid: string;
  name: string;
  email: string;
  role: Role;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export async function authMiddleware(req: Request, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;

    // In development mode: Allow x-user-id header or default to first user in DB if no Bearer token provided
    if (config.nodeEnv === 'development' && (!authHeader || !authHeader.startsWith('Bearer '))) {
      const devUserId = (req.headers['x-user-id'] as string) || undefined;
      const user = devUserId
        ? await prisma.user.findUnique({ where: { id: devUserId } })
        : await prisma.user.findFirst({ orderBy: { createdAt: 'asc' } });

      if (user) {
        req.user = {
          id: user.id,
          adOid: user.adOid,
          name: user.name,
          email: user.email,
          role: user.role,
        };
        return next();
      }
    }

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AppError(401, 'UNAUTHORIZED', 'Authentication token is missing or malformed.');
    }

    // Placeholder hook for Member 1 Azure AD verification
    throw new AppError(401, 'UNAUTHORIZED', 'Azure AD token verification pending Member 1 integration.');
  } catch (error) {
    next(error);
  }
}
