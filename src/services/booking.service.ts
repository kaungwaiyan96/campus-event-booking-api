import prisma from '../config/prisma';
import { AppError } from '../middlewares/error.middleware';
import { AuthUser } from '../middlewares/auth.middleware';
import { BookingStatus } from '@prisma/client';

export class BookingService {
  static async rsvpEvent(eventId: string, user: AuthUser) {
    if (!eventId) {
      throw new AppError(400, 'INVALID_INPUT', 'eventId is required.');
    }

    // Concurrency-safe interactive transaction
    return prisma.$transaction(async (tx) => {
      // 1. Fetch event and check existence
      const event = await tx.event.findUnique({
        where: { id: eventId },
      });

      if (!event) {
        throw new AppError(404, 'NOT_FOUND', 'Event not found.');
      }

      // Check event has not ended
      if (new Date() > event.endTime) {
        throw new AppError(400, 'EVENT_CONCLUDED', 'Cannot RSVP to an event that has already ended.');
      }

      // Concurrency lock on event row to prevent race conditions during RSVP
      await tx.$queryRaw`SELECT id FROM events WHERE id = ${eventId} FOR UPDATE`;

      // 2. Check existing booking for student
      const existing = await tx.booking.findUnique({
        where: {
          eventId_studentId: {
            eventId,
            studentId: user.id,
          },
        },
      });

      if (existing && existing.status === BookingStatus.CONFIRMED) {
        throw new AppError(409, 'ALREADY_BOOKED', 'You already have an active RSVP for this event.');
      }

      // 3. Count active bookings
      const confirmedCount = await tx.booking.count({
        where: {
          eventId,
          status: BookingStatus.CONFIRMED,
        },
      });

      // 4. Verify capacity
      if (confirmedCount >= event.capacity) {
        throw new AppError(400, 'CAPACITY_EXCEEDED', 'Event is at full capacity.');
      }

      if (existing) {
        // Reactivate previously cancelled booking
        return tx.booking.update({
          where: { id: existing.id },
          data: {
            status: BookingStatus.CONFIRMED,
            bookedAt: new Date(),
          },
          include: {
            event: {
              select: {
                id: true,
                title: true,
                venueName: true,
                startTime: true,
                endTime: true,
              },
            },
          },
        });
      }

      // 5. Create new confirmed booking
      return tx.booking.create({
        data: {
          eventId,
          studentId: user.id,
          status: BookingStatus.CONFIRMED,
        },
        include: {
          event: {
            select: {
              id: true,
              title: true,
              venueName: true,
              startTime: true,
              endTime: true,
            },
          },
        },
      });
    });
  }

  static async getMyBookings(user: AuthUser) {
    return prisma.booking.findMany({
      where: {
        studentId: user.id,
      },
      include: {
        event: {
          select: {
            id: true,
            title: true,
            venueName: true,
            venueAddress: true,
            startTime: true,
            endTime: true,
          },
        },
      },
      orderBy: { bookedAt: 'desc' },
    });
  }

  static async cancelBooking(bookingId: string, user: AuthUser) {
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
    });

    if (!booking) {
      throw new AppError(404, 'NOT_FOUND', 'Booking record not found.');
    }

    if (user.role !== 'ADMIN' && booking.studentId !== user.id) {
      throw new AppError(403, 'FORBIDDEN', 'You can only cancel your own bookings.');
    }

    if (booking.status === BookingStatus.CANCELLED) {
      throw new AppError(400, 'ALREADY_CANCELLED', 'This booking has already been cancelled.');
    }

    return prisma.booking.update({
      where: { id: bookingId },
      data: {
        status: BookingStatus.CANCELLED,
      },
    });
  }
}
