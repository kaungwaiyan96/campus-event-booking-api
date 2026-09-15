import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { AuthContext, type AuthState } from '../auth/AuthProvider';
import { AppShell } from './AppShell';

const anonymousAuth: AuthState = {
  status: 'anonymous',
  profile: null,
  signIn: async () => undefined,
  signOut: async () => undefined,
  retryProfile: async () => undefined,
  getAccessToken: async () => null,
};

describe('AppShell', () => {
  it('presents the academic product identity and public navigation', () => {
    render(
      <MemoryRouter>
        <AuthContext.Provider value={anonymousAuth}>
          <AppShell><p>Page body</p></AppShell>
        </AuthContext.Provider>
      </MemoryRouter>,
    );
    expect(screen.getByRole('link', { name: /campus events/i })).toHaveAttribute('href', '/');
    expect(screen.getByRole('navigation', { name: /primary/i })).toBeInTheDocument();
    expect(screen.getByText('Page body')).toBeInTheDocument();
  });
});
