import type { ApiClient } from './client';
import type { Booking } from './types';

export function getMyBookings(client: ApiClient): Promise<Booking[]> {
  return client.request<Booking[]>('/bookings/my-bookings', { auth: true });
}

export function createBooking(client: ApiClient, eventId: string): Promise<Booking> {
  return client.request<Booking>('/bookings', {
    method: 'POST',
    auth: true,
    body: JSON.stringify({ eventId }),
  });
}

export function cancelBooking(client: ApiClient, id: string): Promise<{ message: string; booking: Booking }> {
  return client.request<{ message: string; booking: Booking }>(`/bookings/${id}`, {
    method: 'DELETE',
    auth: true,
  });
}
