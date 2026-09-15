import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../api/client';
import type { UserProfile } from '../api/types';
import { renderWithAppProviders } from '../test/render';
import { App } from '../App';

const msal = vi.hoisted(() => ({
  getActiveAccount: vi.fn(),
  getAllAccounts: vi.fn(),
  setActiveAccount: vi.fn(),
  loginPopup: vi.fn(),
  logoutPopup: vi.fn(),
  acquireTokenSilent: vi.fn(),
  acquireTokenPopup: vi.fn(),
}));

const api = vi.hoisted(() => ({
  getMyProfile: vi.fn(),
}));

vi.mock('./msal', () => ({
  loginRequest: { scopes: ['api://campus-events/access_as_user'] },
  msalInstance: msal,
}));

vi.mock('../api/auth', () => api);

const account = {
  homeAccountId: 'home-account-id',
  localAccountId: 'local-account-id',
  environment: 'login.microsoftonline.com',
  tenantId: 'tenant-id',
  username: 'avery@example.test',
  name: 'Avery Organizer',
};

const organizerProfile: UserProfile = {
  id: 'user-1',
  name: 'Avery Organizer',
  email: 'avery@example.test',
  adOid: 'ad-object-id',
  role: 'ORGANIZER',
  _count: { bookings: 0, events: 3 },
};

describe('AuthProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    msal.getActiveAccount.mockReturnValue(null);
    msal.getAllAccounts.mockReturnValue([]);
    msal.loginPopup.mockResolvedValue({ account });
    msal.logoutPopup.mockResolvedValue(undefined);
    msal.acquireTokenSilent.mockResolvedValue({ accessToken: 'access-token' });
    api.getMyProfile.mockResolvedValue(organizerProfile);
  });

  it('signs in, obtains the verified profile role, and signs out', async () => {
    const user = userEvent.setup();

    renderWithAppProviders(<App />);

    await user.click(await screen.findByRole('button', { name: /sign in with microsoft/i }));

    expect(msal.loginPopup).toHaveBeenCalledWith(expect.objectContaining({
      scopes: ['api://campus-events/access_as_user'],
    }));
    expect(await screen.findByText('ORGANIZER')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /sign out/i }));

    expect(msal.logoutPopup).toHaveBeenCalled();
    expect(screen.getByRole('button', { name: /sign in with microsoft/i })).toBeInTheDocument();
  });

  it('offers a profile retry without trusting unverified account claims', async () => {
    const user = userEvent.setup();
    msal.getActiveAccount.mockReturnValue({ ...account, idTokenClaims: { roles: ['ADMIN'] } });
    api.getMyProfile
      .mockRejectedValueOnce(new Error('profile endpoint unavailable'))
      .mockResolvedValueOnce(organizerProfile);

    renderWithAppProviders(<App />);

    expect(await screen.findByRole('alert')).toHaveTextContent(/could not load your campus profile/i);
    expect(screen.queryByText('ADMIN')).not.toBeInTheDocument();
    expect(screen.queryByText('ORGANIZER')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /retry profile/i }));

    expect(await screen.findByText('ORGANIZER')).toBeInTheDocument();
  });

  it('returns to a sign-in state when the verified profile endpoint rejects the account', async () => {
    msal.getActiveAccount.mockReturnValue(account);
    api.getMyProfile.mockRejectedValue(new ApiError(401, 'UNAUTHORIZED', 'Authentication is required.'));

    renderWithAppProviders(<App />);

    expect(await screen.findByRole('button', { name: /sign in with microsoft/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /retry profile/i })).not.toBeInTheDocument();
    expect(msal.setActiveAccount).toHaveBeenCalledWith(null);
  });
});
