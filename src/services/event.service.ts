import { Prisma } from '@prisma/client';
import prisma from '../config/prisma';
import { AppError } from '../middlewares/error.middleware';
import { CreateEventDTO, UpdateEventDTO, EventQueryFilters } from '../types/event.types';
import { AuthUser } from '../middlewares/auth.middleware';
import { config } from '../config/env';
import { fetchExternalPublicData } from './externalApi.service';

export class EventService {
  static async listEvents(filters: EventQueryFilters) {
    const where: Prisma.EventWhereInput = {};

    if (filters.search) {
      where.OR = [
        { title: { contains: filters.search, mode: 'insensitive' } },
        { description: { contains: filters.search, mode: 'insensitive' } },
        { venueName: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    if (filters.venue) {
      where.venueName = { contains: filters.venue, mode: 'insensitive' };
    }

    if (filters.upcoming === 'true') {
      where.startTime = { gte: new Date() };
    }

    if (filters.date) {
      const parsedDate = new Date(filters.date);
      if (!isNaN(parsedDate.getTime())) {
        const startOfDay = new Date(parsedDate);
        startOfDay.setUTCHours(0, 0, 0, 0);
        const endOfDay = new Date(parsedDate);
        endOfDay.setUTCHours(23, 59, 59, 999);

        const currentFilter = (where.startTime && typeof where.startTime === 'object' ? where.startTime : {}) as Prisma.DateTimeFilter;
        where.startTime = {
          ...currentFilter,
          gte: currentFilter.gte ? (currentFilter.gte > startOfDay ? currentFilter.gte : startOfDay) : startOfDay,
          lte: endOfDay,
        };
      }
    }

    const events = await prisma.event.findMany({
      where,
      orderBy: { startTime: 'asc' },
      include: {
        organizer: {
          select: { id: true, name: true, email: true },
        },
        _count: {
          select: {
            bookings: {
              where: { status: 'CONFIRMED' },
            },
          },
        },
      },
    });

    return events.map((event) => ({
      id: event.id,
      title: event.title,
      description: event.description,
      venueName: event.venueName,
      venueAddress: event.venueAddress,
      mapImageUrl: event.mapImageUrl,
      startTime: event.startTime,
      endTime: event.endTime,
      capacity: event.capacity,
      confirmedBookings: event._count.bookings,
      remainingCapacity: Math.max(0, event.capacity - event._count.bookings),
      organizer: event.organizer,
      createdAt: event.createdAt,
    }));
  }

  static async getEventById(id: string) {
    const event = await prisma.event.findUnique({
      where: { id },
      include: {
        organizer: {
          select: { id: true, name: true, email: true },
        },
        _count: {
          select: {
            bookings: {
              where: { status: 'CONFIRMED' },
            },
          },
        },
      },
    });

    if (!event) {
      throw new AppError(404, 'NOT_FOUND', 'Event not found.');
    }

    const weather = await fetchExternalPublicData(config.campusCoordinates);

    return {
      ...event,
      confirmedBookings: event._count.bookings,
      remainingCapacity: Math.max(0, event.capacity - event._count.bookings),
      weather,
    };
  }

  static async createEvent(data: CreateEventDTO, user: AuthUser) {
    const startTime = new Date(data.startTime);
    const endTime = new Date(data.endTime);

    if (isNaN(startTime.getTime()) || isNaN(endTime.getTime())) {
      throw new AppError(400, 'INVALID_DATE', 'Invalid date format provided.');
    }

    if (startTime >= endTime) {
      throw new AppError(400, 'INVALID_TIME_RANGE', 'startTime must be strictly earlier than endTime.');
    }

    if (data.capacity < 1) {
      throw new AppError(400, 'INVALID_CAPACITY', 'Capacity must be at least 1.');
    }

    return prisma.event.create({
      data: {
        title: data.title,
        description: data.description,
        venueName: data.venueName,
        venueAddress: data.venueAddress,
        mapImageUrl: data.mapImageUrl,
        startTime,
        endTime,
        capacity: data.capacity,
        organizerId: user.id,
      },
      include: {
        organizer: {
          select: { id: true, name: true, email: true },
        },
      },
    });
  }

  static async updateEvent(id: string, data: UpdateEventDTO, user: AuthUser) {
    const existing = await prisma.event.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            bookings: { where: { status: 'CONFIRMED' } },
          },
        },
      },
    });

    if (!existing) {
      throw new AppError(404, 'NOT_FOUND', 'Event not found.');
    }

    if (user.role !== 'ADMIN' && existing.organizerId !== user.id) {
      throw new AppError(403, 'FORBIDDEN', 'You do not have permission to update this event.');
    }

    if (data.capacity !== undefined && data.capacity < 1) {
      throw new AppError(400, 'INVALID_CAPACITY', 'Capacity must be at least 1.');
    }

    if (data.capacity !== undefined && data.capacity < existing._count.bookings) {
      throw new AppError(
        400,
        'CAPACITY_TOO_LOW',
        `Cannot reduce capacity below currently confirmed bookings (${existing._count.bookings}).`
      );
    }

    let startTime = existing.startTime;
    let endTime = existing.endTime;

    if (data.startTime) {
      startTime = new Date(data.startTime);
      if (isNaN(startTime.getTime())) {
        throw new AppError(400, 'INVALID_DATE', 'Invalid date format provided.');
      }
    }
    if (data.endTime) {
      endTime = new Date(data.endTime);
      if (isNaN(endTime.getTime())) {
        throw new AppError(400, 'INVALID_DATE', 'Invalid date format provided.');
      }
    }

    if (startTime >= endTime) {
      throw new AppError(400, 'INVALID_TIME_RANGE', 'startTime must be strictly earlier than endTime.');
    }

    return prisma.event.update({
      where: { id },
      data: {
        title: data.title,
        description: data.description,
        venueName: data.venueName,
        venueAddress: data.venueAddress,
        mapImageUrl: data.mapImageUrl,
        startTime,
        endTime,
        capacity: data.capacity,
      },
    });
  }

  static async deleteEvent(id: string, user: AuthUser) {
    const existing = await prisma.event.findUnique({ where: { id } });

    if (!existing) {
      throw new AppError(404, 'NOT_FOUND', 'Event not found.');
    }

    if (user.role !== 'ADMIN' && existing.organizerId !== user.id) {
      throw new AppError(403, 'FORBIDDEN', 'You do not have permission to delete this event.');
    }

    await prisma.event.delete({ where: { id } });
    return { message: 'Event and associated bookings successfully deleted.' };
  }

  static async getEventAttendees(id: string, user: AuthUser) {
    const existing = await prisma.event.findUnique({ where: { id } });

    if (!existing) {
      throw new AppError(404, 'NOT_FOUND', 'Event not found.');
    }

    if (user.role !== 'ADMIN' && existing.organizerId !== user.id) {
      throw new AppError(403, 'FORBIDDEN', 'You do not have permission to view attendee details.');
    }

    const attendees = await prisma.booking.findMany({
      where: {
        eventId: id,
        status: 'CONFIRMED',
      },
      include: {
        student: {
          select: { id: true, name: true, email: true },
        },
      },
      orderBy: { bookedAt: 'asc' },
    });

    return attendees.map((b) => ({
      bookingId: b.id,
      bookedAt: b.bookedAt,
      student: b.student,
    }));
  }
}
