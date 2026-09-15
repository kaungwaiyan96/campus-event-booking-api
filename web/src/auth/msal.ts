import { PublicClientApplication } from '@azure/msal-browser';
import { publicEnv } from '../config/env';

export const loginRequest = {
  scopes: [publicEnv.apiScope],
};

export const msalInstance = new PublicClientApplication({
  auth: {
    clientId: publicEnv.clientId,
    authority: `https://login.microsoftonline.com/${publicEnv.tenantId}`,
    redirectUri: publicEnv.redirectUri,
  },
  cache: {
    cacheLocation: 'sessionStorage',
  },
});
