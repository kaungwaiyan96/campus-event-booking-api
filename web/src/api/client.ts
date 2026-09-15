import type { ApiEnvelope, ApiFailure } from './types';

export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

export interface ApiClient {
  request<T>(path: string, init?: RequestInit & { auth?: boolean }): Promise<T>;
}

function isApiFailure(value: unknown): value is ApiFailure {
  return typeof value === 'object'
    && value !== null
    && 'success' in value
    && value.success === false
    && 'error' in value
    && typeof value.error === 'object'
    && value.error !== null
    && 'code' in value.error
    && 'message' in value.error
    && typeof value.error.code === 'string'
    && typeof value.error.message === 'string';
}

function isApiEnvelope<T>(value: unknown): value is ApiEnvelope<T> {
  return typeof value === 'object'
    && value !== null
    && 'success' in value
    && value.success === true
    && 'data' in value;
}

function safeMessage(status: number): string {
  return `Request failed with status ${status}.`;
}

export function createApiClient(options: {
  baseUrl: string;
  getAccessToken: () => Promise<string | null>;
}): ApiClient {
  const baseUrl = options.baseUrl.replace(/\/$/, '');

  return {
    async request<T>(path: string, init: RequestInit & { auth?: boolean } = {}) {
      const { auth, headers: suppliedHeaders, ...requestInit } = init;
      const headers = new Headers(suppliedHeaders);
      headers.set('Accept', 'application/json');

      if (requestInit.body !== undefined && requestInit.body !== null && !headers.has('Content-Type')) {
        headers.set('Content-Type', 'application/json');
      }

      if (auth) {
        const accessToken = await options.getAccessToken();
        if (accessToken) {
          headers.set('Authorization', `Bearer ${accessToken}`);
        }
      }

      const response = await fetch(`${baseUrl}${path}`, { ...requestInit, headers });
      const responseText = await response.text();
      let payload: unknown;

      try {
        payload = responseText ? JSON.parse(responseText) : undefined;
      } catch {
        payload = undefined;
      }

      if (!response.ok) {
        if (isApiFailure(payload)) {
          throw new ApiError(response.status, payload.error.code, payload.error.message);
        }
        throw new ApiError(response.status, 'REQUEST_FAILED', safeMessage(response.status));
      }

      if (isApiEnvelope<T>(payload)) {
        return payload.data;
      }

      if (isApiFailure(payload)) {
        throw new ApiError(response.status, payload.error.code, payload.error.message);
      }

      throw new ApiError(response.status, 'INVALID_RESPONSE', 'The server returned an invalid response.');
    },
  };
}
