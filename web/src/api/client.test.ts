import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError, createApiClient } from './client';
import { cancelBooking, createBooking } from './bookings';
import { createEvent, listEvents, updateEvent } from './events';
import type { ApiClient } from './client';
import type { Booking, EventDetail, EventInput } from './types';

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe('createApiClient', () => {
  it('sends a bearer token and unwraps a successful authenticated response', async () => {
    const fetchSpy = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      success: true,
      data: { id: 'user-1', name: 'Avery' },
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    globalThis.fetch = fetchSpy;
    const client = createApiClient({
      baseUrl: 'https://api.example.test/events-api/v1/',
      getAccessToken: async () => 'access-token',
    });

    await expect(client.request<{ id: string; name: string }>('/auth/me', { auth: true }))
      .resolves.toEqual({ id: 'user-1', name: 'Avery' });
    expect(fetchSpy).toHaveBeenCalledWith('https://api.example.test/events-api/v1/auth/me', expect.anything());
    const [, requestInit] = fetchSpy.mock.calls[0] as [string, RequestInit];
    const headers = new Headers(requestInit.headers);
    expect(headers.get('Accept')).toBe('application/json');
    expect(headers.get('Authorization')).toBe('Bearer access-token');
  });

  it('converts a forbidden backend envelope into a safe ApiError', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      success: false,
      error: { code: 'FORBIDDEN', message: 'You do not have permission to update this event.' },
    }), { status: 403, headers: { 'Content-Type': 'application/json' } }));
    const client = createApiClient({
      baseUrl: 'https://api.example.test/events-api/v1',
      getAccessToken: async () => null,
    });

    const error = await client.request('/auth/me', { auth: true }).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({
      status: 403,
      code: 'FORBIDDEN',
      message: 'You do not have permission to update this event.',
    });
  });

  it('sets Content-Type only when a request has a body', async () => {
    const fetchSpy = vi.fn().mockImplementation(() => Promise.resolve(new Response(JSON.stringify({ success: true, data: {} }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })));
    globalThis.fetch = fetchSpy;
    const client = createApiClient({ baseUrl: 'https://api.example.test', getAccessToken: async () => null });

    await client.request('/without-body');
    await client.request('/with-body', { method: 'POST', body: JSON.stringify({ name: 'Avery' }) });

    const withoutBody = new Headers((fetchSpy.mock.calls[0][1] as RequestInit).headers);
    const withBody = new Headers((fetchSpy.mock.calls[1][1] as RequestInit).headers);
    expect(withoutBody.has('Content-Type')).toBe(false);
    expect(withBody.get('Content-Type')).toBe('application/json');
  });

  it('does not acquire an access token for an unauthenticated request', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ success: true, data: {} }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }));
    const getAccessToken = vi.fn(async () => 'access-token');
    const client = createApiClient({ baseUrl: 'https://api.example.test', getAccessToken });

    await client.request('/events');

    expect(getAccessToken).not.toHaveBeenCalled();
  });

  it('normalizes a non-JSON HTTP failure without exposing its response body', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(new Response('gateway diagnostic: token=secret', { status: 502 }));
    const client = createApiClient({ baseUrl: 'https://api.example.test', getAccessToken: async () => null });

    await expect(client.request('/events')).rejects.toMatchObject({
      status: 502,
      code: 'REQUEST_FAILED',
      message: 'Request failed with status 502.',
    });
  });

  it('normalizes a rejected fetch without exposing the underlying error', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('Network error: access-token=secret'));
    const client = createApiClient({ baseUrl: 'https://api.example.test', getAccessToken: async () => null });

    await expect(client.request('/events')).rejects.toMatchObject({
      status: 0,
      code: 'NETWORK_ERROR',
      message: 'Unable to reach the server.',
    });
  });
});

const eventInput: EventInput = {
  title: 'Campus clean-up',
  description: 'Help tidy the quad.',
  venueName: 'Main Quad',
  venueAddress: '1 University Way',
  startTime: '2026-10-01T09:00:00.000Z',
  endTime: '2026-10-01T11:00:00.000Z',
  capacity: 30,
};

const canonicalEvent: EventDetail = {
  id: 'event-1',
  ...eventInput,
  mapImageUrl: null,
  confirmedBookings: 4,
  remainingCapacity: 26,
  organizer: { id: 'organizer-1', name: 'Avery Organizer', email: 'avery@example.test' },
  createdAt: '2026-09-16T00:00:00.000Z',
  weather: {
    source: 'open-meteo',
    available: true,
    temperatureC: 29,
    weatherCode: 1,
    observedAt: '2026-10-01T08:00:00.000Z',
  },
};

function createRecordingClient(respond: (path: string, init?: RequestInit & { auth?: boolean }) => unknown) {
  const calls: Array<[string, (RequestInit & { auth?: boolean }) | undefined]> = [];
  const client: ApiClient = {
    async request<T>(path: string, init?: RequestInit & { auth?: boolean }): Promise<T> {
      calls.push([path, init]);
      return respond(path, init) as T;
    },
  };

  return { client, calls };
}

describe('mutation endpoint contracts', () => {
  it('re-reads a created event so callers receive all canonical event fields', async () => {
    const { client, calls } = createRecordingClient((path) => {
      if (path === '/events') return { id: 'event-1' };
      return canonicalEvent;
    });

    await expect(createEvent(client, eventInput)).resolves.toEqual(canonicalEvent);
    expect(calls.map(([path]) => path)).toEqual(['/events', '/events/event-1']);
    expect(calls[0][1]).toMatchObject({ method: 'POST', auth: true, body: JSON.stringify(eventInput) });
  });

  it('re-reads an updated event so callers receive all canonical event fields', async () => {
    const { client, calls } = createRecordingClient((_path, init) => {
      if (init?.method === 'PUT') return { id: 'event-1' };
      return canonicalEvent;
    });

    await expect(updateEvent(client, 'event-1', { title: 'Updated clean-up' })).resolves.toEqual(canonicalEvent);
    expect(calls.map(([path]) => path)).toEqual(['/events/event-1', '/events/event-1']);
  });

  it('re-reads bookings and returns the matching canonical booking after creation', async () => {
    const canonicalBooking: Booking = {
      id: 'booking-1',
      status: 'CONFIRMED',
      bookedAt: '2026-09-16T00:00:00.000Z',
      event: {
        id: 'event-1',
        title: 'Campus clean-up',
        venueName: 'Main Quad',
        venueAddress: '1 University Way',
        startTime: '2026-10-01T09:00:00.000Z',
        endTime: '2026-10-01T11:00:00.000Z',
      },
    };
    const { client, calls } = createRecordingClient((path) => {
      if (path === '/bookings') return { id: 'booking-1' };
      return [canonicalBooking];
    });

    await expect(createBooking(client, 'event-1')).resolves.toEqual(canonicalBooking);
    expect(calls.map(([path]) => path)).toEqual(['/bookings', '/bookings/my-bookings']);
    expect(calls[0][1]).toMatchObject({ method: 'POST', auth: true, body: JSON.stringify({ eventId: 'event-1' }) });
  });

  it('throws a safe ApiError when the newly created booking is absent from the read-back', async () => {
    const { client } = createRecordingClient((path) => path === '/bookings'
      ? { id: 'booking-1' }
      : []);

    await expect(createBooking(client, 'event-1')).rejects.toMatchObject({
      status: 500,
      code: 'INVALID_RESPONSE',
      message: 'The created booking was not found in your bookings.',
    });
  });

  it('re-reads a cancelled booking so callers receive the canonical booking fields', async () => {
    const canonicalBooking: Booking = {
      id: 'booking-1',
      status: 'CANCELLED',
      bookedAt: '2026-09-16T00:00:00.000Z',
      event: {
        id: 'event-1',
        title: 'Campus clean-up',
        venueName: 'Main Quad',
        venueAddress: '1 University Way',
        startTime: '2026-10-01T09:00:00.000Z',
        endTime: '2026-10-01T11:00:00.000Z',
      },
    };
    const { client, calls } = createRecordingClient((path) => path === '/bookings/booking-1'
      ? { message: 'Booking cancelled successfully. Capacity freed.', booking: { id: 'booking-1' } }
      : [canonicalBooking]);

    await expect(cancelBooking(client, 'booking-1')).resolves.toEqual({
      message: 'Booking cancelled successfully. Capacity freed.',
      booking: canonicalBooking,
    });
    expect(calls.map(([path]) => path)).toEqual(['/bookings/booking-1', '/bookings/my-bookings']);
  });

  it('throws a safe ApiError when the cancelled booking is absent from the read-back', async () => {
    const { client } = createRecordingClient((path) => path === '/bookings/booking-1'
      ? { message: 'Booking cancelled successfully. Capacity freed.', booking: { id: 'booking-1' } }
      : []);

    await expect(cancelBooking(client, 'booking-1')).rejects.toMatchObject({
      status: 500,
      code: 'INVALID_RESPONSE',
      message: 'The cancelled booking was not found in your bookings.',
    });
  });
});

describe('event filter encoding', () => {
  it('encodes populated filters and omits empty strings and false upcoming values', async () => {
    const { client, calls } = createRecordingClient(() => []);

    await listEvents(client, {
      search: 'campus event',
      venue: '',
      date: '2026-10-01',
      upcoming: false,
    });
    await listEvents(client, { upcoming: true });

    expect(calls).toEqual([
      ['/events?search=campus+event&date=2026-10-01', undefined],
      ['/events?upcoming=true', undefined],
    ]);
  });
});
