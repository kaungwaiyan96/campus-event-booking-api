import { describe, expect, it } from 'vitest';
import { parsePublicEnv } from './env';

describe('parsePublicEnv', () => {
  it('rejects an empty Entra client ID with a clear error', () => {
    expect(() => parsePublicEnv({
      VITE_API_BASE_URL: 'http://localhost:5000/events-api/v1',
      VITE_ENTRA_TENANT_ID: 'c1f3dc23-b7f8-48d3-9b5d-2b12f158f01f',
      VITE_ENTRA_CLIENT_ID: '',
      VITE_ENTRA_API_SCOPE: 'api://d16771d8-2e37-476a-be7c-63f4ed09c819/access_as_user',
      VITE_ENTRA_REDIRECT_URI: 'http://localhost:5173',
    })).toThrow('VITE_ENTRA_CLIENT_ID is required');
  });
});
