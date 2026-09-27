import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../api/client';
import type { AuthState } from '../../auth/AuthProvider';
import { ToastProvider } from '../../components/ToastProvider';
import { BookEventButton } from './BookEventButton';

const createBooking = vi.hoisted(() => vi.fn());

vi.mock('../../api/bookings', () => ({ createBooking }));
vi.mock('../../api/useApi', () => ({ useApi: () => ({}) }));
vi.mock('../../auth/useAuth', () => ({ useAuth: () => authenticatedStudent }));

const authenticatedStudent: AuthState = {
  status: 'authenticated',
  profile: {
    id: 'student-1', adOid: 'oid-1', name: 'Student One', email: 'student@example.test', role: 'STUDENT',
    _count: { bookings: 0, events: 0 },
  },
  signIn: async () => undefined,
  signOut: async () => undefined,
  retryProfile: async () => undefined,
  getAccessToken: async () => 'token',
};

function renderButton(remainingCapacity: number) {
  return render(<ToastProvider><BookEventButton eventId="event-1" remainingCapacity={remainingCapacity} /></ToastProvider>);
}

describe('BookEventButton', () => {
  afterEach(cleanup);

  beforeEach(() => {
    createBooking.mockReset();
  });

  it('disables booking when the event has no remaining places', () => {
    renderButton(0);

    expect(screen.getByRole('button', { name: /event full/i })).toBeDisabled();
  });

  it('submits one booking and disables while it is pending', async () => {
    const user = userEvent.setup();
    let resolveBooking: (value: unknown) => void = () => undefined;
    createBooking.mockReturnValue(new Promise((resolve) => { resolveBooking = resolve; }));
    renderButton(1);

    await user.click(screen.getByRole('button', { name: /^book event$/i }));

    expect(createBooking).toHaveBeenCalledWith(expect.anything(), 'event-1');
    expect(screen.getByRole('button', { name: /booking/i })).toBeDisabled();

    resolveBooking({ id: 'booking-1' });
  });

  it.each([
    ['ALREADY_BOOKED', 'You already have a booking for this event.'],
    ['CAPACITY_EXCEEDED', 'This event is now full.'],
  ])('maps %s to a friendly message', async (code, message) => {
    const user = userEvent.setup();
    createBooking.mockRejectedValue(new ApiError(409, code, 'Raw backend message'));
    renderButton(1);

    await user.click(screen.getByRole('button', { name: /^book event$/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(message);
  });
});
