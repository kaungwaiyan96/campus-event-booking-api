import type { Event } from '@prisma/client';

export interface ActiveEventResponse {
  success: true;
  data: { active: boolean; event: Event | null };
}

export interface VenueCoordinates {
  latitude: number;
  longitude: number;
}

export interface VenueWeather {
  source: 'open-meteo';
  available: boolean;
  temperatureC: number | null;
  weatherCode: number | null;
  observedAt: string | null;
  reason?: 'INVALID_COORDINATES' | 'UNAVAILABLE';
}
