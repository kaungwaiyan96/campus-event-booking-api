import { Request, Response, NextFunction } from 'express';
import prisma from '../config/prisma';
import { AppError } from '../middlewares/error.middleware';
import { ActiveEventResponse } from '../types/peer.types';

export async function getActiveEvent(req: Request, res: Response, next: NextFunction) {
  try {
    const location = req.query.location;
    if (typeof location !== 'string' || !location.trim()) {
      throw new AppError(400, 'BAD_REQUEST', 'location must be a non-empty venue name.');
    }
    const now = new Date();
    const event = await prisma.event.findFirst({
      where: {
        venueName: location.trim(),
        startTime: { lte: now },
        endTime: { gte: now },
      },
      // Stable selection if multiple events overlap at the same venue.
      orderBy: [{ startTime: 'asc' }, { id: 'asc' }],
    });
    const response: ActiveEventResponse = { success: true, data: { active: event !== null, event } };
    res.json(response);
  } catch (error) {
    next(error);
  }
}
