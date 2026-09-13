import { Request, Response, NextFunction } from 'express';
import { BookingService } from '../services/booking.service';

export class BookingController {
  static async rsvp(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await BookingService.rsvpEvent(req.body.eventId, req.user!);
      res.status(201).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  static async getMyBookings(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await BookingService.getMyBookings(req.user!);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  static async cancelBooking(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await BookingService.cancelBooking(req.params.id, req.user!);
      res.json({
        success: true,
        data: {
          message: 'Booking cancelled successfully. Capacity freed.',
          booking: data,
        },
      });
    } catch (err) {
      next(err);
    }
  }
}
