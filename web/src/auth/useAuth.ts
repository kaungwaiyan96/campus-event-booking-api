import { useContext } from 'react';
import { AuthContext, type AuthState } from './AuthProvider';

export function useAuth(): AuthState {
  const auth = useContext(AuthContext);

  if (!auth) {
    throw new Error('useAuth must be used within an AuthProvider.');
  }

  return auth;
}
