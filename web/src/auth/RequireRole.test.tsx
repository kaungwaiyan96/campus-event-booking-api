import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { AuthState } from './AuthProvider';
import { AuthContext } from './AuthProvider';
import { RequireRole } from './RequireRole';

function renderGuard(auth: AuthState) {
  return render(
    <AuthContext.Provider value={auth}>
      <RequireRole allowedRoles={['ORGANIZER']}><p>Protected content</p></RequireRole>
    </AuthContext.Provider>,
  );
}

const baseAuth: Omit<AuthState, 'status' | 'profile'> = {
  signIn: async () => undefined,
  signOut: async () => undefined,
  retryProfile: async () => undefined,
  getAccessToken: async () => null,
};

describe('RequireRole', () => {
  it('keeps a loading profile check distinct from a permission denial', () => {
    renderGuard({ ...baseAuth, status: 'loading', profile: null });

    expect(screen.getByRole('status')).toHaveTextContent(/checking your campus profile/i);
    expect(screen.queryByText(/do not have permission/i)).not.toBeInTheDocument();
  });

  it('offers profile recovery instead of a permission denial after a profile error', () => {
    const retryProfile = vi.fn(async () => undefined);
    renderGuard({ ...baseAuth, status: 'error', profile: null, retryProfile });

    expect(screen.getByRole('alert')).toHaveTextContent(/could not load your campus profile/i);
    expect(screen.getByRole('button', { name: /retry profile/i })).toBeInTheDocument();
    expect(screen.queryByText(/do not have permission/i)).not.toBeInTheDocument();
  });
});
