import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { EventSummary, UserProfile } from '../api/types';
import type { AuthState } from '../auth/AuthProvider';
import { ToastProvider } from '../components/ToastProvider';
import { ManageEventsPage } from './ManageEventsPage';

const createEvent = vi.hoisted(() => vi.fn());
const deleteEvent = vi.hoisted(() => vi.fn());
const getAttendees = vi.hoisted(() => vi.fn());
const listEvents = vi.hoisted(() => vi.fn());
const updateEvent = vi.hoisted(() => vi.fn());

vi.mock('../api/events', () => ({ createEvent, deleteEvent, getAttendees, listEvents, updateEvent }));
vi.mock('../api/useApi', () => ({ useApi: () => ({}) }));

let authenticatedProfile: UserProfile = {
  id: 'organizer-1',
  adOid: 'organizer-oid',
  name: 'Avery Organizer',
  email: 'avery@campus.edu',
  role: 'ORGANIZER',
  _count: { bookings: 0, events: 1 },
};

vi.mock('../auth/useAuth', () => ({
  useAuth: (): AuthState => ({
    status: 'authenticated',
    profile: authenticatedProfile,
    signIn: async () => undefined,
    signOut: async () => undefined,
    retryProfile: async () => undefined,
    getAccessToken: async () => 'token',
  }),
}));

const ownedEvent: EventSummary = {
  id: 'event-1',
  title: 'Cloud Computing Workshop',
  description: 'Learn cloud deployment foundations.',
  venueName: 'Innovation Lab',
  venueAddress: '1 University Way',
  mapImageUrl: null,
  startTime: '2026-10-20T09:00:00.000Z',
  endTime: '2026-10-20T11:00:00.000Z',
  capacity: 40,
  confirmedBookings: 12,
  remainingCapacity: 28,
  organizer: { id: 'organizer-1', name: 'Avery Organizer', email: 'avery@campus.edu' },
  createdAt: '2026-09-16T00:00:00.000Z',
};

const otherEvent: EventSummary = {
  ...ownedEvent,
  id: 'event-2',
  title: 'Guest Lecture',
  organizer: { id: 'organizer-2', name: 'Jordan Organizer', email: 'jordan@campus.edu' },
};

function renderPage() {
  return render(<MemoryRouter><ToastProvider><ManageEventsPage /></ToastProvider></MemoryRouter>);
}

function deferred<T>() {
  let resolve: (value: T) => void = () => undefined;
  let reject: (reason?: unknown) => void = () => undefined;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, reject, resolve };
}

async function openCreateForm(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: /create event/i }));
  return screen.getByRole('dialog', { name: /create event/i });
}

async function fillRequiredEventFields(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText(/^title$/i), 'Campus Innovation Fair');
  await user.type(screen.getByLabelText(/^description$/i), 'A student-led showcase.');
  await user.type(screen.getByLabelText(/^venue name$/i), 'Student Centre');
  await user.type(screen.getByLabelText(/^venue address$/i), '9 University Way');
  await user.type(screen.getByLabelText(/^start date and time$/i), '2026-10-25T09:00');
  await user.type(screen.getByLabelText(/^end date and time$/i), '2026-10-25T11:00');
  await user.clear(screen.getByLabelText(/^capacity$/i));
  await user.type(screen.getByLabelText(/^capacity$/i), '60');
}

describe('ManageEventsPage', () => {
  afterEach(cleanup);

  beforeEach(() => {
    authenticatedProfile = { ...authenticatedProfile, role: 'ORGANIZER', id: 'organizer-1' };
    createEvent.mockReset();
    deleteEvent.mockReset();
    getAttendees.mockReset();
    listEvents.mockReset();
    updateEvent.mockReset();
    listEvents.mockResolvedValue([ownedEvent, otherEvent]);
    createEvent.mockResolvedValue({ ...ownedEvent, id: 'event-3', title: 'Campus Innovation Fair' });
    updateEvent.mockResolvedValue({ ...ownedEvent, title: 'Updated workshop' });
    deleteEvent.mockResolvedValue({ message: 'Event deleted.' });
    getAttendees.mockResolvedValue([
      { bookingId: 'booking-1', bookedAt: '2026-09-18T10:00:00.000Z', student: { id: 'student-1', name: 'Student One', email: 'student@campus.edu' } },
    ]);
  });

  it('only gives an organizer controls for events they own, while an admin can manage every event', async () => {
    const { rerender } = renderPage();

    expect(await screen.findByText('Cloud Computing Workshop')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /edit cloud computing workshop/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /edit guest lecture/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /delete guest lecture/i })).not.toBeInTheDocument();

    authenticatedProfile = { ...authenticatedProfile, role: 'ADMIN', id: 'admin-1' };
    rerender(<MemoryRouter><ToastProvider><ManageEventsPage /></ToastProvider></MemoryRouter>);

    expect(await screen.findByRole('button', { name: /edit guest lecture/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /delete guest lecture/i })).toBeInTheDocument();
  });

  it('validates required event form fields, capacity, and schedule order before creating', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText('Cloud Computing Workshop');
    await openCreateForm(user);

    await user.click(within(screen.getByRole('dialog', { name: /create event/i })).getByRole('button', { name: /^create event$/i }));
    expect(await screen.findByText(/title is required/i)).toBeInTheDocument();
    expect(createEvent).not.toHaveBeenCalled();

    await fillRequiredEventFields(user);
    await user.clear(screen.getByLabelText(/^capacity$/i));
    await user.type(screen.getByLabelText(/^capacity$/i), '0');
    await user.click(within(screen.getByRole('dialog', { name: /create event/i })).getByRole('button', { name: /^create event$/i }));
    expect(screen.getByText(/capacity must be at least 1/i)).toBeInTheDocument();

    await user.clear(screen.getByLabelText(/^capacity$/i));
    await user.type(screen.getByLabelText(/^capacity$/i), '60');
    await user.clear(screen.getByLabelText(/^end date and time$/i));
    await user.type(screen.getByLabelText(/^end date and time$/i), '2026-10-25T08:00');
    await user.click(within(screen.getByRole('dialog', { name: /create event/i })).getByRole('button', { name: /^create event$/i }));
    expect(screen.getByText(/end time must be after start time/i)).toBeInTheDocument();
    expect(createEvent).not.toHaveBeenCalled();
  });

  it('treats the event form as a modal: it portals, focuses its heading, traps focus, and restores its trigger', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText('Cloud Computing Workshop');
    const trigger = screen.getByRole('button', { name: /create event/i });
    const applicationRoot = screen.getByRole('heading', { name: /manage events/i }).closest('section')?.parentElement;

    await user.click(trigger);

    const dialog = screen.getByRole('dialog', { name: /create event/i });
    const heading = screen.getByRole('heading', { name: /create event/i });
    expect(dialog.parentElement?.parentElement).toBe(document.body);
    expect(applicationRoot).toHaveAttribute('aria-hidden', 'true');
    expect(heading).toHaveFocus();

    await user.tab({ shift: true });
    expect(screen.getByRole('button', { name: /^create event$/i })).toHaveFocus();

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog', { name: /create event/i })).not.toBeInTheDocument();
    expect(applicationRoot).not.toHaveAttribute('aria-hidden');
    expect(trigger).toHaveFocus();
  });

  it('creates an event with ISO datetimes and refreshes the management list', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText('Cloud Computing Workshop');
    await openCreateForm(user);
    await fillRequiredEventFields(user);

    await user.click(within(screen.getByRole('dialog', { name: /create event/i })).getByRole('button', { name: /^create event$/i }));

    await waitFor(() => expect(createEvent).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      title: 'Campus Innovation Fair',
      capacity: 60,
      startTime: new Date('2026-10-25T09:00').toISOString(),
      endTime: new Date('2026-10-25T11:00').toISOString(),
    })));
    expect(await screen.findByText(/event created/i)).toBeInTheDocument();
    expect(listEvents).toHaveBeenCalledTimes(2);
  });

  it('edits an owned event and sends the updated form values', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText('Cloud Computing Workshop');

    await user.click(screen.getByRole('button', { name: /edit cloud computing workshop/i }));
    const title = screen.getByLabelText(/^title$/i);
    await user.clear(title);
    await user.type(title, 'Updated workshop');
    await user.click(screen.getByRole('button', { name: /^save changes$/i }));

    expect(updateEvent).toHaveBeenCalledWith(expect.anything(), 'event-1', expect.objectContaining({ title: 'Updated workshop' }));
    expect(await screen.findByText(/event updated/i)).toBeInTheDocument();
  });

  it('waits for deletion confirmation before deleting and removes the event after success', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText('Cloud Computing Workshop');

    await user.click(screen.getByRole('button', { name: /delete cloud computing workshop/i }));
    expect(screen.getByRole('dialog', { name: /delete event/i })).toBeInTheDocument();
    expect(deleteEvent).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: /delete event/i }));
    expect(deleteEvent).toHaveBeenCalledWith(expect.anything(), 'event-1');
    expect(await screen.findByText(/event deleted/i)).toBeInTheDocument();
    expect(screen.queryByText('Cloud Computing Workshop')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /manage events/i })).toHaveFocus();
  });

  it('uses an accurate pending deletion label while the confirmed delete request is in flight', async () => {
    const user = userEvent.setup();
    const pending = deferred<{ message: string }>();
    deleteEvent.mockImplementationOnce(() => pending.promise);
    renderPage();
    await screen.findByText('Cloud Computing Workshop');

    await user.click(screen.getByRole('button', { name: /delete cloud computing workshop/i }));
    await user.click(screen.getByRole('button', { name: /^delete event$/i }));
    expect(screen.getByRole('button', { name: 'Deleting…' })).toBeDisabled();

    await act(async () => {
      pending.resolve({ message: 'Event deleted.' });
      await Promise.resolve();
    });
    expect(await screen.findByText(/event deleted/i)).toBeInTheDocument();
  });

  it('loads attendees only after the attendee dialog opens and shows their details', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText('Cloud Computing Workshop');
    expect(getAttendees).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: /view attendees for cloud computing workshop/i }));
    expect(getAttendees).toHaveBeenCalledTimes(1);
    expect(await screen.findByText('student@campus.edu')).toBeInTheDocument();
    expect(screen.getByText('Student One')).toBeInTheDocument();
    expect(within(screen.getByRole('dialog', { name: /cloud computing workshop/i })).getByText(/booked/i)).toBeInTheDocument();
  });

  it('treats the attendee list as a modal and restores focus after Escape', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText('Cloud Computing Workshop');
    const trigger = screen.getByRole('button', { name: /view attendees for cloud computing workshop/i });
    const applicationRoot = screen.getByRole('heading', { name: /manage events/i }).closest('section')?.parentElement;

    await user.click(trigger);

    const dialog = screen.getByRole('dialog', { name: /cloud computing workshop/i });
    const heading = within(dialog).getByRole('heading', { name: /cloud computing workshop/i });
    expect(dialog.parentElement?.parentElement).toBe(document.body);
    expect(applicationRoot).toHaveAttribute('aria-hidden', 'true');
    expect(heading).toHaveFocus();

    await user.tab({ shift: true });
    expect(screen.getByRole('link', { name: 'student@campus.edu' })).toHaveFocus();

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog', { name: /cloud computing workshop/i })).not.toBeInTheDocument();
    expect(applicationRoot).not.toHaveAttribute('aria-hidden');
    expect(trigger).toHaveFocus();
  });

  it('keeps the newest attendee request when switching events before the first request resolves', async () => {
    const user = userEvent.setup();
    const first = deferred<Array<{ bookingId: string; bookedAt: string; student: { id: string; name: string; email: string } }>>();
    const second = deferred<Array<{ bookingId: string; bookedAt: string; student: { id: string; name: string; email: string } }>>();
    authenticatedProfile = { ...authenticatedProfile, role: 'ADMIN', id: 'admin-1' };
    getAttendees.mockImplementationOnce(() => first.promise).mockImplementationOnce(() => second.promise);
    renderPage();
    await screen.findByText('Cloud Computing Workshop');

    await user.click(screen.getByRole('button', { name: /view attendees for cloud computing workshop/i }));
    await user.click(screen.getByRole('button', { name: /view attendees for guest lecture/i, hidden: true }));
    await act(async () => {
      second.resolve([{ bookingId: 'booking-2', bookedAt: '2026-09-19T10:00:00.000Z', student: { id: 'student-2', name: 'Student Two', email: 'student-two@campus.edu' } }]);
      await Promise.resolve();
    });
    expect(await screen.findByText('student-two@campus.edu')).toBeInTheDocument();

    await act(async () => {
      first.resolve([{ bookingId: 'booking-1', bookedAt: '2026-09-18T10:00:00.000Z', student: { id: 'student-1', name: 'Student One', email: 'student@campus.edu' } }]);
      await Promise.resolve();
    });
    await waitFor(() => expect(screen.queryByText('student@campus.edu')).not.toBeInTheDocument());
    expect(screen.getByRole('dialog', { name: /guest lecture/i })).toBeInTheDocument();
  });

  it('does not reopen or populate attendees after the dialog closes during a request', async () => {
    const user = userEvent.setup();
    const pending = deferred<Array<{ bookingId: string; bookedAt: string; student: { id: string; name: string; email: string } }>>();
    getAttendees.mockImplementationOnce(() => pending.promise);
    renderPage();
    await screen.findByText('Cloud Computing Workshop');

    await user.click(screen.getByRole('button', { name: /view attendees for cloud computing workshop/i }));
    await user.click(screen.getByRole('button', { name: /close attendees/i }));
    await act(async () => {
      pending.resolve([{ bookingId: 'booking-1', bookedAt: '2026-09-18T10:00:00.000Z', student: { id: 'student-1', name: 'Student One', email: 'student@campus.edu' } }]);
      await Promise.resolve();
    });

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(screen.queryByText('student@campus.edu')).not.toBeInTheDocument();
  });

  it('shows an attendee error and retries only when the organizer requests it', async () => {
    const user = userEvent.setup();
    getAttendees.mockRejectedValueOnce(new Error('Unavailable')).mockResolvedValueOnce([
      { bookingId: 'booking-1', bookedAt: '2026-09-18T10:00:00.000Z', student: { id: 'student-1', name: 'Student One', email: 'student@campus.edu' } },
    ]);
    renderPage();
    await screen.findByText('Cloud Computing Workshop');

    await user.click(screen.getByRole('button', { name: /view attendees for cloud computing workshop/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/could not load attendees/i);
    expect(getAttendees).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole('button', { name: /try again/i }));
    expect(getAttendees).toHaveBeenCalledTimes(2);
    expect(await screen.findByText('student@campus.edu')).toBeInTheDocument();
  });
});
