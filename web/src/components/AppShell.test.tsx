import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it } from 'vitest';
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

afterEach(cleanup);

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
    expect(screen.getByRole('link', { name: 'Events' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByText('Page body')).toBeInTheDocument();
  });

  it('highlights the current booking tab for a student', () => {
    render(
      <MemoryRouter initialEntries={['/bookings']}>
        <AuthContext.Provider value={{ ...anonymousAuth, status: 'authenticated', profile: { id: '1', name: 'Student', email: 'student@example.com', adOid: 'student-oid', role: 'STUDENT', _count: { bookings: 0, events: 0 } } }}>
          <AppShell><p>Page body</p></AppShell>
        </AuthContext.Provider>
      </MemoryRouter>,
    );
    expect(screen.getByRole('link', { name: 'My Bookings' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Events' })).not.toHaveAttribute('aria-current');
  });
});
