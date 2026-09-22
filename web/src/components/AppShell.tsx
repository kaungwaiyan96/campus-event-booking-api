import type { ReactNode } from 'react';
import { Link, NavLink } from 'react-router-dom';
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
          <Link className="brand" to="/">
            <span className="brand-mark" aria-hidden="true"><span /></span>
            <span>Campus <span className="brand-accent">Events</span></span>
          </Link>
          <nav className="primary-nav" aria-label="Primary">
            <NavLink end to="/">Events</NavLink>
            {canViewBookings && <NavLink to="/bookings">My Bookings</NavLink>}
            {canManageEvents && <NavLink to="/manage/events">Manage Events</NavLink>}
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
