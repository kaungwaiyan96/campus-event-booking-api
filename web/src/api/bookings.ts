import { ApiError, type ApiClient } from './client';
import type { Booking } from './types';

export function getMyBookings(client: ApiClient): Promise<Booking[]> {
  return client.request<Booking[]>('/bookings/my-bookings', { auth: true });
}

export async function createBooking(client: ApiClient, eventId: string): Promise<Booking> {
  const created = await client.request<{ id: string }>('/bookings', {
    method: 'POST',
    auth: true,
    body: JSON.stringify({ eventId }),
  });

  const booking = (await getMyBookings(client)).find(({ id }) => id === created.id);
  if (!booking) {
    throw new ApiError(500, 'INVALID_RESPONSE', 'The created booking was not found in your bookings.');
  }

  return booking;
}

export async function cancelBooking(client: ApiClient, id: string): Promise<{ message: string; booking: Booking }> {
  const cancelled = await client.request<{ message: string; booking: { id: string } }>(`/bookings/${id}`, {
    method: 'DELETE',
    auth: true,
  });

  const booking = (await getMyBookings(client)).find(({ id: bookingId }) => bookingId === cancelled.booking.id);
  if (!booking) {
    throw new ApiError(500, 'INVALID_RESPONSE', 'The cancelled booking was not found in your bookings.');
  }

  return { message: cancelled.message, booking };
}
