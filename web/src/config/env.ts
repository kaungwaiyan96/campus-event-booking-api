export interface PublicEnv {
  apiBaseUrl: string;
  tenantId: string;
  clientId: string;
  apiScope: string;
  redirectUri: string;
}

type PublicEnvKey =
  | 'VITE_API_BASE_URL'
  | 'VITE_ENTRA_TENANT_ID'
  | 'VITE_ENTRA_CLIENT_ID'
  | 'VITE_ENTRA_API_SCOPE'
  | 'VITE_ENTRA_REDIRECT_URI';

function required(source: Record<string, string | undefined>, key: PublicEnvKey): string {
  const value = source[key]?.trim();

  if (!value) {
    throw new Error(`${key} is required`);
  }

  return value;
}

export function parsePublicEnv(source: Record<string, string | undefined>): PublicEnv {
  return {
    apiBaseUrl: required(source, 'VITE_API_BASE_URL'),
    tenantId: required(source, 'VITE_ENTRA_TENANT_ID'),
    clientId: required(source, 'VITE_ENTRA_CLIENT_ID'),
    apiScope: required(source, 'VITE_ENTRA_API_SCOPE'),
    redirectUri: required(source, 'VITE_ENTRA_REDIRECT_URI'),
  };
}

export const publicEnv: PublicEnv = parsePublicEnv(import.meta.env);
