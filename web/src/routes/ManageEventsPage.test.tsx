import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
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
});
