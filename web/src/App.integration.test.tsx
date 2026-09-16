import { cleanup, render, screen } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { UserProfile } from './api/types';
import type { AuthState } from './auth/AuthProvider';
import { ConfirmDialog } from './components/ConfirmDialog';
import { ManagedEventCard } from './features/manage/ManagedEventCard';
import { App } from './App';

const useAuth = vi.hoisted(() => vi.fn());

vi.mock('./auth/useAuth', () => ({ useAuth }));

vi.mock('./routes/EventsPage', () => ({
  EventsPage: () => <h1>Discover campus events</h1>,
}));

vi.mock('./routes/EventDetailPage', () => ({
  EventDetailPage: () => <h1>Event details</h1>,
}));

vi.mock('./routes/MyBookingsPage', () => ({
  MyBookingsPage: () => <h1>My bookings</h1>,
}));

vi.mock('./routes/ManageEventsPage', () => ({
  ManageEventsPage: () => <h1>Manage events</h1>,
}));

const baseProfile: UserProfile = {
  id: 'user-1',
  adOid: 'ad-oid-1',
  name: 'Avery Campus',
  email: 'avery@campus.test',
  role: 'STUDENT',
  _count: { bookings: 0, events: 0 },
};

function authState(profile: UserProfile | null): AuthState {
  return {
    status: profile ? 'authenticated' : 'anonymous',
    profile,
    signIn: async () => undefined,
    signOut: async () => undefined,
    retryProfile: async () => undefined,
    getAccessToken: async () => null,
  };
}

function renderApp(path: string, profile: UserProfile | null) {
  useAuth.mockReturnValue(authState(profile));
  return render(<MemoryRouter initialEntries={[path]}><App /></MemoryRouter>);
}

function DialogExample() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button type="button" onClick={() => setIsOpen(true)}>Open confirmation</button>
      <ConfirmDialog
        isOpen={isOpen}
        title="Cancel booking"
        confirmLabel="Confirm cancellation"
        onCancel={() => setIsOpen(false)}
        onConfirm={() => setIsOpen(false)}
      >
        <p>Cancel this booking?</p>
      </ConfirmDialog>
    </>
  );
}

describe('the integrated campus event application', () => {
  afterEach(cleanup);

  beforeEach(() => {
    useAuth.mockReset();
  });

  it('keeps public browsing available while hiding protected navigation and handling a direct booking URL', () => {
    renderApp('/bookings', null);

    expect(screen.getByRole('main')).toHaveAttribute('id', 'main-content');
    expect(screen.getByRole('link', { name: /campus events/i })).toHaveAttribute('href', '/');
    expect(screen.getByRole('link', { name: /^events$/i })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /my bookings/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /manage events/i })).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /sign in required/i })).toBeInTheDocument();
  });

  it.each([
    ['STUDENT', '/bookings', 'My bookings', true, false],
    ['ORGANIZER', '/manage/events', 'Manage events', false, true],
    ['ADMIN', '/manage/events', 'Manage events', true, true],
  ] as const)('gives %s only the expected protected navigation and routes', (role, path, pageName, seesBookings, seesManagement) => {
    renderApp(path, { ...baseProfile, role });

    expect(screen.getByRole('heading', { name: pageName })).toBeInTheDocument();
    expect(Boolean(screen.queryByRole('link', { name: /my bookings/i }))).toBe(seesBookings);
    expect(Boolean(screen.queryByRole('link', { name: /manage events/i }))).toBe(seesManagement);
  });

  it('does not expose a forbidden management route to a student', () => {
    renderApp('/manage/events', baseProfile);

    expect(screen.getByRole('heading', { name: /do not have permission/i })).toBeInTheDocument();
  });

  it('provides a working skip link target', () => {
    renderApp('/', null);

    expect(screen.getByRole('link', { name: /skip to main content/i })).toHaveAttribute('href', '#main-content');
    expect(screen.getByRole('main')).toHaveAttribute('id', 'main-content');
  });

  it('shows a not-found route instead of silently rendering an empty protected shell', () => {
    renderApp('/a-route-that-does-not-exist', null);

    expect(screen.getByRole('heading', { name: /page not found/i })).toBeInTheDocument();
  });

  it('focuses a confirmation heading, supports Escape, and returns focus to its trigger', async () => {
    const user = userEvent.setup();
    render(<DialogExample />);
    const trigger = screen.getByRole('button', { name: /open confirmation/i });

    await user.click(trigger);
    const heading = screen.getByRole('heading', { name: /cancel booking/i });
    expect(trigger.parentElement).toHaveAttribute('aria-hidden', 'true');
    expect(heading).toHaveFocus();

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(trigger.parentElement).not.toHaveAttribute('aria-hidden');
    expect(trigger).toHaveFocus();
  });

  it('keeps management event data headed at a narrow viewport', () => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 390 });
    window.dispatchEvent(new Event('resize'));
    render(
      <ManagedEventCard
        event={{
          id: 'event-1',
          title: 'Cloud Computing Workshop',
          description: 'Learn cloud foundations.',
          venueName: 'Innovation Lab',
          venueAddress: '1 University Way',
          mapImageUrl: null,
          startTime: '2026-10-20T09:00:00.000Z',
          endTime: '2026-10-20T11:00:00.000Z',
          capacity: 40,
          confirmedBookings: 12,
          remainingCapacity: 28,
          organizer: { id: 'organizer-1', name: 'Avery Organizer', email: 'avery@campus.test' },
          createdAt: '2026-09-16T00:00:00.000Z',
        }}
        canManage
        onEdit={() => undefined}
        onDelete={() => undefined}
        onViewAttendees={() => undefined}
      />,
    );

    expect(screen.getByRole('heading', { level: 2, name: /cloud computing workshop/i })).toBeInTheDocument();
  });

  it('defines a reduced-motion override for the animated interface', () => {
    const styles = readFileSync('src/styles/global.css', 'utf8');

    expect(styles).toContain('@media (prefers-reduced-motion: reduce)');
    expect(styles).toContain('animation-duration: 0.01ms !important;');
  });
});
