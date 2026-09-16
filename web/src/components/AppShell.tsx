import type { ReactNode } from 'react';
import { useAuth } from '../auth/useAuth';
import { ProfileMenu } from './ProfileMenu';

interface AppShellProps {
  children: ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const { profile } = useAuth();
  const canViewBookings = profile?.role === 'STUDENT' || profile?.role === 'ADMIN';
  const canManageEvents = profile?.role === 'ORGANIZER' || profile?.role === 'ADMIN';

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">Skip to main content</a>
      <header className="site-header">
        <div className="page-container header-content">
          <a className="brand" href="/">Campus Events</a>
          <nav aria-label="Primary">
            <a href="/">Events</a>
            {canViewBookings && <a href="/bookings">My Bookings</a>}
            {canManageEvents && <a href="/manage/events">Manage Events</a>}
          </nav>
          <ProfileMenu />
        </div>
      </header>
      <main className="page-container" id="main-content" tabIndex={-1}>
        {children}
      </main>
      <footer className="site-footer">
        <div className="page-container">Campus Events</div>
      </footer>
    </div>
  );
}
