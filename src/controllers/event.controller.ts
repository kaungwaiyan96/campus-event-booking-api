import { Request, Response, NextFunction } from 'express';
import { EventService } from '../services/event.service';

export class EventController {
  static async listEvents(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await EventService.listEvents(req.query);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  static async getEventById(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await EventService.getEventById(req.params.id);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  static async createEvent(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await EventService.createEvent(req.body, req.user!);
      res.status(201).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  static async updateEvent(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await EventService.updateEvent(req.params.id, req.body, req.user!);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  static async deleteEvent(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await EventService.deleteEvent(req.params.id, req.user!);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  static async getAttendees(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await EventService.getEventAttendees(req.params.id, req.user!);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }
}
