import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { EventSummary } from '../api/types';
import { EventsPage } from './EventsPage';

const listEvents = vi.hoisted(() => vi.fn());

vi.mock('../api/events', () => ({ listEvents }));
vi.mock('../api/useApi', () => ({ useApi: () => ({}) }));

const cloudWorkshop: EventSummary = {
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
  organizer: { id: 'organizer-1', name: 'Avery Organizer', email: 'avery@example.test' },
  createdAt: '2026-09-16T00:00:00.000Z',
};

describe('EventsPage', () => {
  afterEach(cleanup);

  beforeEach(() => {
    listEvents.mockReset();
    listEvents.mockResolvedValue([cloudWorkshop]);
  });

  it('shows the public event results returned on initial load', async () => {
    render(<MemoryRouter><EventsPage /></MemoryRouter>);

    expect(await screen.findByText('Cloud Computing Workshop')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /view details for cloud computing workshop/i }))
      .toHaveAttribute('href', '/events/event-1');
  });

  it('keeps draft filters local until the user explicitly applies them', async () => {
    const user = userEvent.setup();
    render(<MemoryRouter><EventsPage /></MemoryRouter>);

    await screen.findByText('Cloud Computing Workshop');
    await user.type(screen.getByLabelText(/search events/i), 'cloud');
    expect(listEvents).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole('button', { name: /apply filters/i }));

    expect(listEvents).toHaveBeenLastCalledWith(expect.anything(), expect.objectContaining({ search: 'cloud' }));
  });

  it('explains when filters return no events', async () => {
    listEvents.mockResolvedValue([]);
    render(<MemoryRouter><EventsPage /></MemoryRouter>);

    expect(await screen.findByText(/no events found/i)).toBeInTheDocument();
  });
});
