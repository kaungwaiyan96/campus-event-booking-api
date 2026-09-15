import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError, createApiClient } from './client';

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
});
