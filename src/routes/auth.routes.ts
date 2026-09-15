import { Router } from 'express';
import { authController } from '../controllers/auth.controller';
import { authMiddleware } from '../middlewares/auth.middleware';
import { requireRole } from '../middlewares/role.middleware';
import { Role } from '@prisma/client';
import config from '../config/env';

export const authRoutes = Router();
export const userRoutes = Router();

// Auth routes (mounted at /events-api/v1/auth)
authRoutes.get('/me', authMiddleware, (req, res, next) => authController.getProfile(req, res, next));
authRoutes.post('/sync', authMiddleware, (req, res, next) => authController.syncProfile(req, res, next));

if (config.nodeEnv !== 'production') {
  authRoutes.post('/dev-token', (req, res, next) => authController.generateDevToken(req, res, next));
}

// User management routes (mounted at /events-api/v1/users)
userRoutes.patch('/:id/role', authMiddleware, requireRole(Role.ADMIN), (req, res, next) =>
  authController.updateUserRole(req, res, next)
);

export default authRoutes;
