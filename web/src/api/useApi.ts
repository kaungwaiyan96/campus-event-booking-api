import { useContext } from 'react';
import { ApiContext } from './ApiProvider';
import type { ApiClient } from './client';

export function useApi(): ApiClient {
  const client = useContext(ApiContext);

  if (!client) {
    throw new Error('useApi must be used within an ApiProvider.');
  }

  return client;
}
