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

export function cancelBooking(client: ApiClient, id: string): Promise<{ message: string; booking: Booking }> {
  return client.request<{ message: string; booking: Booking }>(`/bookings/${id}`, {
    method: 'DELETE',
    auth: true,
  });
}
