import { createContext, useMemo, type ReactNode } from 'react';
import { useAuth } from '../auth/useAuth';
import { publicEnv } from '../config/env';
import { createApiClient, type ApiClient } from './client';

export const ApiContext = createContext<ApiClient | null>(null);

interface ApiProviderProps {
  children: ReactNode;
}

export function ApiProvider({ children }: ApiProviderProps) {
  const { getAccessToken } = useAuth();
  const client = useMemo(() => createApiClient({
    baseUrl: publicEnv.apiBaseUrl,
    getAccessToken,
  }), [getAccessToken]);

  return <ApiContext.Provider value={client}>{children}</ApiContext.Provider>;
}
