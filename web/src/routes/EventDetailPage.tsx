import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { getEvent } from '../api/events';
import type { EventDetail } from '../api/types';
import { useApi } from '../api/useApi';
import { useAuth } from '../auth/useAuth';
import { LoadingSkeleton } from '../components/LoadingSkeleton';
import { Notice } from '../components/Notice';
import { WeatherCard } from '../features/events/WeatherCard';
import { BookEventButton } from '../features/bookings/BookEventButton';

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'full', timeStyle: 'short' }).format(new Date(value));
}

function BookingPresentation({ event, onBooked }: { event: EventDetail; onBooked(): void }) {
  const { profile, signIn, status } = useAuth();

  if (status === 'anonymous') {
    return <button type="button" onClick={() => void signIn()}>Sign in to book</button>;
  }

  if (profile?.role === 'STUDENT' || profile?.role === 'ADMIN') {
    return <BookEventButton eventId={event.id} remainingCapacity={event.remainingCapacity} onBooked={onBooked} />;
  }

  return null;
}

export function EventDetailPage() {
  const { eventId } = useParams<{ eventId: string }>();
  const client = useApi();
  const clientRef = useRef(client);
  const requestVersion = useRef(0);
  const [event, setEvent] = useState<EventDetail | null>(null);
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');

  clientRef.current = client;

  const loadEvent = useCallback(async () => {
    if (!eventId) {
      setStatus('error');
      return;
    }
    const version = ++requestVersion.current;
    setStatus('loading');
    try {
      const result = await getEvent(clientRef.current, eventId);
      if (version !== requestVersion.current) return;
      setEvent(result);
      setStatus('success');
    } catch {
      if (version !== requestVersion.current) return;
      setStatus('error');
    }
  }, [eventId]);

  useEffect(() => {
    void loadEvent();
    return () => { requestVersion.current += 1; };
  }, [loadEvent]);

  if (status === 'loading') return <LoadingSkeleton label="Loading event details" rows={5} />;
  if (status === 'error' || !event) {
    return (
      <Notice tone="error" title="We could not load this event">
        <button type="button" onClick={() => void loadEvent()}>Try again</button>
      </Notice>
    );
  }

  return (
    <article className="event-detail" aria-labelledby="event-title">
      <Link className="back-link" to="/">← All events</Link>
      <header>
        <p className="eyebrow">{event.venueName}</p>
        <h1 id="event-title">{event.title}</h1>
        <p className="event-description">{event.description}</p>
      </header>
      <div className="event-detail-grid">
        <section className="detail-panel" aria-labelledby="schedule-title">
          <h2 id="schedule-title">Schedule</h2>
          <p><strong>Starts:</strong> {formatDateTime(event.startTime)}</p>
          <p><strong>Ends:</strong> {formatDateTime(event.endTime)}</p>
        </section>
        <section className="detail-panel" aria-labelledby="capacity-title">
          <h2 id="capacity-title">Capacity</h2>
          <p><strong>{event.remainingCapacity} places remaining</strong> of {event.capacity}</p>
          <p>{event.confirmedBookings} confirmed bookings</p>
        </section>
        <section className="detail-panel" aria-labelledby="organizer-title">
          <h2 id="organizer-title">Organizer</h2>
          <p>{event.organizer.name}</p>
          <p><a href={`mailto:${event.organizer.email}`}>{event.organizer.email}</a></p>
        </section>
        <section className="detail-panel" aria-labelledby="venue-title">
          <h2 id="venue-title">Venue</h2>
          <p>{event.venueName}</p>
          <p>{event.venueAddress}</p>
        </section>
        <WeatherCard weather={event.weather} />
        {event.mapImageUrl ? (
          <figure className="map-panel">
            <img src={event.mapImageUrl} alt={`Map for ${event.venueName}`} />
            <figcaption>Venue map</figcaption>
          </figure>
        ) : (
          <section className="map-panel map-fallback" aria-labelledby="venue-map-title">
            <h2 id="venue-map-title">Venue map</h2>
            <p>Map imagery is not available. Please use the venue address above.</p>
          </section>
        )}
      </div>
      <section className="booking-presentation" aria-label="Booking">
        <BookingPresentation event={event} onBooked={() => void loadEvent()} />
      </section>
    </article>
  );
}
