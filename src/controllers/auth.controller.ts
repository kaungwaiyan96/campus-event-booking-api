import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { Role } from '@prisma/client';
import prisma from '../config/prisma';
import config from '../config/env';
import { AppError } from '../middlewares/error.middleware';

/**
 * Auth & User Controller
 * Implemented by Member 1 (Mi Hnin Au Shwe Yee)
 */
export class AuthController {
  /**
   * GET /events-api/v1/auth/me
   * Returns authenticated user profile and roles
   */
  public async getProfile(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        throw new AppError(401, 'UNAUTHORIZED', 'User not authenticated.');
      }

      const user = await prisma.user.findUnique({
        where: { id: req.user.id },
        include: {
          _count: {
            select: {
              bookings: true,
              events: true,
            },
          },
        },
      });

      if (!user) {
        throw new AppError(404, 'NOT_FOUND', 'User record not found in database.');
      }

      res.json({
        success: true,
        data: user,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /events-api/v1/auth/sync
   * Syncs profile details from Active Directory into local PostgreSQL DB
   */
  public async syncProfile(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        throw new AppError(401, 'UNAUTHORIZED', 'User not authenticated.');
      }

      const { name, email } = req.body;

      const updatedUser = await prisma.user.update({
        where: { id: req.user.id },
        data: {
          ...(name && { name }),
          ...(email && { email }),
        },
      });

      res.json({
        success: true,
        message: 'User profile synchronized successfully.',
        data: updatedUser,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * PATCH /events-api/v1/users/:id/role
   * ADMIN only: updates another user's role
   */
  public async updateUserRole(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const { role } = req.body;

      if (!role || !Object.values(Role).includes(role)) {
        throw new AppError(
          400,
          'BAD_REQUEST',
          `Invalid role. Must be one of: ${Object.values(Role).join(', ')}`
        );
      }

      const targetUser = await prisma.user.findUnique({ where: { id } });
      if (!targetUser) {
        throw new AppError(404, 'NOT_FOUND', `User with ID ${id} not found.`);
      }

      const updatedUser = await prisma.user.update({
        where: { id },
        data: { role },
      });

      res.json({
        success: true,
        message: `User role updated to ${role}.`,
        data: updatedUser,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /events-api/v1/auth/dev-token
   * Demo/Testing utility: Generates a test JWT with requested role for evaluation & grading
   */
  public async generateDevToken(req: Request, res: Response, next: NextFunction) {
    try {
      const { role = Role.STUDENT, email, name } = req.body;

      if (!Object.values(Role).includes(role)) {
        throw new AppError(400, 'BAD_REQUEST', `Role must be one of: ${Object.values(Role).join(', ')}`);
      }

      const userEmail = email || `demo_${role.toLowerCase()}@university.edu`;
      const userName = name || `Demo ${role.charAt(0) + role.slice(1).toLowerCase()} User`;
      const adOid = `ad-oid-demo-${role.toLowerCase()}`;

      // Find or create demo user in DB
      let user = await prisma.user.findFirst({
        where: {
          OR: [{ adOid }, { email: userEmail }],
        },
      });

      if (!user) {
        user = await prisma.user.create({
          data: {
            adOid,
            name: userName,
            email: userEmail,
            role,
          },
        });
      } else if (user.role !== role) {
        user = await prisma.user.update({
          where: { id: user.id },
          data: { role },
        });
      }

      const token = jwt.sign(
        {
          id: user.id,
          oid: user.adOid,
          name: user.name,
          email: user.email,
          role: user.role,
        },
        config.jwtSecret,
        { expiresIn: '7d' }
      );

      res.json({
        success: true,
        token,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
        },
      });
    } catch (error) {
      next(error);
    }
  }
}

export const authController = new AuthController();
export default authController;
