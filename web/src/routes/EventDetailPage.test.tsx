import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthState } from '../auth/AuthProvider';
import { EventDetailPage } from './EventDetailPage';

const getEvent = vi.hoisted(() => vi.fn());
const useAuth = vi.hoisted(() => vi.fn());

vi.mock('../api/events', () => ({ getEvent }));
vi.mock('../api/useApi', () => ({ useApi: () => ({}) }));
vi.mock('../auth/useAuth', () => ({ useAuth }));

const publicAuth: AuthState = {
  status: 'anonymous',
  profile: null,
  signIn: async () => undefined,
  signOut: async () => undefined,
  retryProfile: async () => undefined,
  getAccessToken: async () => null,
};

const eventDetail = {
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
  weather: {
    source: 'open-meteo' as const,
    available: true,
    temperatureC: 29,
    weatherCode: 1,
    observedAt: '2026-10-20T08:00:00.000Z',
  },
};

function renderDetail() {
  return render(
    <MemoryRouter initialEntries={['/events/event-1']}>
      <Routes><Route path="/events/:eventId" element={<EventDetailPage />} /></Routes>
    </MemoryRouter>,
  );
}

describe('EventDetailPage', () => {
  afterEach(cleanup);

  beforeEach(() => {
    getEvent.mockReset();
    getEvent.mockResolvedValue(eventDetail);
    useAuth.mockReturnValue(publicAuth);
  });

  it('presents capacity, organizer, venue, and available weather inside an article', async () => {
    renderDetail();

    expect(await screen.findByRole('article', { name: /cloud computing workshop/i })).toBeInTheDocument();
    expect(screen.getByText(/28 places remaining/i)).toBeInTheDocument();
    expect(screen.getByText(/avery organizer/i)).toBeInTheDocument();
    expect(screen.getByText('1 University Way')).toBeInTheDocument();
    expect(screen.getByText(/29°C/)).toBeInTheDocument();
    expect(screen.getByText(/sign in to book/i)).toBeInTheDocument();
  });

  it('keeps the event available when weather data is temporarily unavailable', async () => {
    getEvent.mockResolvedValue({
      ...eventDetail,
      weather: {
        ...eventDetail.weather,
        available: false,
        temperatureC: null,
        weatherCode: null,
        observedAt: null,
      },
    });

    renderDetail();

    expect(await screen.findByText(/weather is temporarily unavailable/i)).toBeInTheDocument();
    expect(screen.getByRole('article', { name: /cloud computing workshop/i })).toBeInTheDocument();
  });
});
