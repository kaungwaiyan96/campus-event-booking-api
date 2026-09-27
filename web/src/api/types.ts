export type Role = 'STUDENT' | 'ORGANIZER' | 'ADMIN';

export interface ApiEnvelope<T> {
  success: true;
  data: T;
}

export interface ApiFailure {
  success: false;
  error: { code: string; message: string };
}

export interface Organizer {
  id: string;
  name: string;
  email: string;
}

export interface EventSummary {
  id: string;
  title: string;
  description: string;
  venueName: string;
  venueAddress: string;
  mapImageUrl: string | null;
  startTime: string;
  endTime: string;
  capacity: number;
  confirmedBookings: number;
  remainingCapacity: number;
  organizer: Organizer;
  createdAt: string;
}

export interface Weather {
  source: 'open-meteo';
  available: boolean;
  temperatureC: number | null;
  weatherCode: number | null;
  observedAt: string | null;
  reason?: string;
}

export interface EventDetail extends EventSummary {
  weather: Weather;
}

export interface Booking {
  id: string;
  status: 'CONFIRMED' | 'CANCELLED';
  bookedAt: string;
  event: Pick<EventSummary, 'id' | 'title' | 'venueName' | 'venueAddress' | 'startTime' | 'endTime'>;
}

export interface UserProfile extends Organizer {
  adOid: string;
  role: Role;
  _count: { bookings: number; events: number };
}

export interface EventInput {
  title: string;
  description: string;
  venueName: string;
  venueAddress: string;
  mapImageUrl?: string;
  startTime: string;
  endTime: string;
  capacity: number;
}

export interface EventFilters {
  search?: string;
  venue?: string;
  date?: string;
  upcoming?: boolean;
}

export interface Attendee {
  bookingId: string;
  bookedAt: string;
  student: Organizer;
}
