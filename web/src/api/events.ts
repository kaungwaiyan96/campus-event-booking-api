import type { ApiClient } from './client';
import type { Attendee, EventDetail, EventFilters, EventInput, EventSummary } from './types';

export async function listEvents(client: ApiClient, filters: EventFilters): Promise<EventSummary[]> {
  const query = new URLSearchParams();

  for (const [key, value] of Object.entries(filters)) {
    if (typeof value === 'string' && value.trim()) {
      query.set(key, value);
    }
  }

  if (filters.upcoming) {
    query.set('upcoming', 'true');
  }

  const suffix = query.size ? `?${query}` : '';
  return client.request<EventSummary[]>(`/events${suffix}`);
}

export function getEvent(client: ApiClient, id: string): Promise<EventDetail> {
  return client.request<EventDetail>(`/events/${id}`);
}

export function createEvent(client: ApiClient, input: EventInput): Promise<EventSummary> {
  return client.request<EventSummary>('/events', {
    method: 'POST',
    auth: true,
    body: JSON.stringify(input),
  });
}

export function updateEvent(client: ApiClient, id: string, input: Partial<EventInput>): Promise<EventSummary> {
  return client.request<EventSummary>(`/events/${id}`, {
    method: 'PUT',
    auth: true,
    body: JSON.stringify(input),
  });
}

export function deleteEvent(client: ApiClient, id: string): Promise<{ message: string }> {
  return client.request<{ message: string }>(`/events/${id}`, { method: 'DELETE', auth: true });
}

export function getAttendees(client: ApiClient, id: string): Promise<Attendee[]> {
  return client.request<Attendee[]>(`/events/${id}/attendees`, { auth: true });
}
