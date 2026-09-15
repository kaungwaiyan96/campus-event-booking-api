import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../api/client';
import type { Booking } from '../api/types';
import type { AuthState } from '../auth/AuthProvider';
import { ToastProvider } from '../components/ToastProvider';
import { MyBookingsPage } from './MyBookingsPage';

const cancelBooking = vi.hoisted(() => vi.fn());
const getMyBookings = vi.hoisted(() => vi.fn());

vi.mock('../api/bookings', () => ({ cancelBooking, getMyBookings }));
vi.mock('../api/useApi', () => ({ useApi: () => ({}) }));
vi.mock('../auth/useAuth', () => ({ useAuth: () => authenticatedStudent }));

const authenticatedStudent: AuthState = {
  status: 'authenticated',
  profile: {
    id: 'student-1',
    adOid: 'oid-1',
    name: 'Student One',
    email: 'student@example.test',
    role: 'STUDENT',
    _count: { bookings: 2, events: 0 },
  },
  signIn: async () => undefined,
  signOut: async () => undefined,
  retryProfile: async () => undefined,
  getAccessToken: async () => 'token',
};

const confirmedBooking: Booking = {
  id: 'booking-1',
  status: 'CONFIRMED',
  bookedAt: '2026-09-16T00:00:00.000Z',
  event: {
    id: 'event-1',
    title: 'Cloud Computing Workshop',
    venueName: 'Innovation Lab',
    venueAddress: '1 University Way',
    startTime: '2026-10-20T09:00:00.000Z',
    endTime: '2026-10-20T11:00:00.000Z',
  },
};

const secondBooking: Booking = {
  ...confirmedBooking,
  id: 'booking-2',
  event: { ...confirmedBooking.event, id: 'event-2', title: 'Campus Careers Talk' },
};

function renderPage() {
  return render(<MemoryRouter><ToastProvider><MyBookingsPage /></ToastProvider></MemoryRouter>);
}

describe('MyBookingsPage', () => {
  afterEach(cleanup);

  beforeEach(() => {
    cancelBooking.mockReset();
    getMyBookings.mockReset();
    getMyBookings.mockResolvedValue([confirmedBooking, { ...secondBooking, status: 'CANCELLED' }]);
  });

  it('shows confirmed and cancelled bookings with distinct status labels', async () => {
    renderPage();

    expect(await screen.findByText('Cloud Computing Workshop')).toBeInTheDocument();
    expect(screen.getByText('Confirmed')).toBeInTheDocument();
    expect(screen.getByText('Cancelled')).toBeInTheDocument();
  });

  it('confirms cancellation and replaces only the affected booking after the API succeeds', async () => {
    const user = userEvent.setup();
    getMyBookings.mockResolvedValue([confirmedBooking, secondBooking]);
    cancelBooking.mockResolvedValue({
      message: 'Booking cancelled',
      booking: { ...confirmedBooking, status: 'CANCELLED' },
    });

    renderPage();
    await screen.findByText('Cloud Computing Workshop');

    await user.click(screen.getByRole('button', { name: /cancel booking for cloud computing workshop/i }));
    expect(screen.getByRole('dialog', { name: /cancel booking/i })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /^confirm cancellation$/i }));

    expect(cancelBooking).toHaveBeenCalledWith(expect.anything(), 'booking-1');
    expect(await screen.findByText(/booking cancelled/i)).toBeInTheDocument();
    expect(screen.getAllByText('Cancelled')).toHaveLength(1);
    expect(screen.getByText('Campus Careers Talk')).toBeInTheDocument();
    expect(getMyBookings).toHaveBeenCalledTimes(1);
  });

  it('shows a safe cancellation error when the request fails', async () => {
    const user = userEvent.setup();
    cancelBooking.mockRejectedValue(new ApiError(500, 'REQUEST_FAILED', 'The server is unavailable.'));

    renderPage();
    await screen.findByText('Cloud Computing Workshop');
    await user.click(screen.getByRole('button', { name: /cancel booking for cloud computing workshop/i }));
    await user.click(screen.getByRole('button', { name: /^confirm cancellation$/i }));

    expect(await screen.findByText('The server is unavailable.')).toBeInTheDocument();
  });
});
