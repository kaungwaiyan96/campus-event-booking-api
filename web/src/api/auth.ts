import type { ApiClient } from './client';
import type { UserProfile } from './types';

export function getMyProfile(client: ApiClient): Promise<UserProfile> {
  return client.request<UserProfile>('/auth/me', { auth: true });
}
