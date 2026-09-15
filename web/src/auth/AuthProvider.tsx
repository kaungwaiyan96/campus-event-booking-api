import { InteractionRequiredAuthError, type AccountInfo } from '@azure/msal-browser';
import { createContext, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { getMyProfile } from '../api/auth';
import { createApiClient } from '../api/client';
import type { UserProfile } from '../api/types';
import { publicEnv } from '../config/env';
import { loginRequest, msalInstance } from './msal';

export interface AuthState {
  status: 'anonymous' | 'loading' | 'authenticated' | 'error';
  profile: UserProfile | null;
  signIn(): Promise<void>;
  signOut(): Promise<void>;
  retryProfile(): Promise<void>;
  getAccessToken(): Promise<string | null>;
}

export const AuthContext = createContext<AuthState | null>(null);

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const accountRef = useRef<AccountInfo | null>(msalInstance.getActiveAccount());
  const profileRequestVersion = useRef(0);
  const [status, setStatus] = useState<AuthState['status']>(accountRef.current ? 'loading' : 'anonymous');
  const [profile, setProfile] = useState<UserProfile | null>(null);

  const getAccessToken = useCallback(async (): Promise<string | null> => {
    const account = accountRef.current ?? msalInstance.getActiveAccount();

    if (!account) {
      return null;
    }

    const request = { ...loginRequest, account };

    try {
      return (await msalInstance.acquireTokenSilent(request)).accessToken;
    } catch (error) {
      if (error instanceof InteractionRequiredAuthError) {
        return (await msalInstance.acquireTokenPopup(request)).accessToken;
      }
      throw error;
    }
  }, []);

  const profileClient = useMemo(() => createApiClient({
    baseUrl: publicEnv.apiBaseUrl,
    getAccessToken,
  }), [getAccessToken]);

  const loadProfile = useCallback(async () => {
    const requestVersion = ++profileRequestVersion.current;
    const account = accountRef.current ?? msalInstance.getActiveAccount();

    if (!account) {
      setProfile(null);
      setStatus('anonymous');
      return;
    }

    accountRef.current = account;
    setProfile(null);
    setStatus('loading');

    try {
      const verifiedProfile = await getMyProfile(profileClient);

      if (requestVersion !== profileRequestVersion.current) {
        return;
      }

      setProfile(verifiedProfile);
      setStatus('authenticated');
    } catch {
      if (requestVersion !== profileRequestVersion.current) {
        return;
      }

      setProfile(null);
      setStatus('error');
    }
  }, [profileClient]);

  useEffect(() => {
    if (accountRef.current) {
      void loadProfile();
    }
  }, [loadProfile]);

  const signIn = useCallback(async () => {
    setProfile(null);
    setStatus('loading');

    try {
      const response = await msalInstance.loginPopup(loginRequest);
      const account = response.account ?? msalInstance.getActiveAccount();

      if (!account) {
        setStatus('error');
        return;
      }

      accountRef.current = account;
      msalInstance.setActiveAccount(account);
      await loadProfile();
    } catch {
      setProfile(null);
      setStatus('error');
    }
  }, [loadProfile]);

  const signOut = useCallback(async () => {
    const account = accountRef.current ?? msalInstance.getActiveAccount();

    try {
      await msalInstance.logoutPopup(account ? { account } : undefined);
      profileRequestVersion.current += 1;
      accountRef.current = null;
      setProfile(null);
      setStatus('anonymous');
    } catch {
      setStatus('error');
    }
  }, []);

  const value = useMemo<AuthState>(() => ({
    status,
    profile,
    signIn,
    signOut,
    retryProfile: loadProfile,
    getAccessToken,
  }), [getAccessToken, loadProfile, profile, signIn, signOut, status]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
