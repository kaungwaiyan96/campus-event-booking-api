import { useCallback, useEffect, useRef, useState } from 'react';
import { listEvents } from '../api/events';
import type { EventFilters as EventFiltersValue, EventSummary } from '../api/types';
import { useApi } from '../api/useApi';
import { EmptyState } from '../components/EmptyState';
import { LoadingSkeleton } from '../components/LoadingSkeleton';
import { Notice } from '../components/Notice';
import { EventFilters } from '../features/events/EventFilters';
import { EventGrid } from '../features/events/EventGrid';

export function EventsPage() {
  const client = useApi();
  const clientRef = useRef(client);
  const requestVersion = useRef(0);
  const [draftFilters, setDraftFilters] = useState<EventFiltersValue>({});
  const [events, setEvents] = useState<EventSummary[]>([]);
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');

  clientRef.current = client;

  const loadEvents = useCallback(async (filters: EventFiltersValue) => {
    const version = ++requestVersion.current;
    setStatus('loading');

    try {
      const result = await listEvents(clientRef.current, filters);
      if (version !== requestVersion.current) return;
      setEvents(result);
      setStatus('success');
    } catch {
      if (version !== requestVersion.current) return;
      setStatus('error');
    }
  }, []);

  useEffect(() => {
    void loadEvents({});
    return () => { requestVersion.current += 1; };
  }, [loadEvents]);

  return (
    <div className="events-page">
      <section className="hero" aria-labelledby="page-title">
        <p className="eyebrow">University community</p>
        <h1 id="page-title">Discover campus events</h1>
        <p>Find lectures, activities, and gatherings across campus.</p>
      </section>
      <EventFilters
        value={draftFilters}
        onChange={setDraftFilters}
        onApply={() => void loadEvents(draftFilters)}
        onClear={() => {
          setDraftFilters({});
          void loadEvents({});
        }}
      />
      {status === 'loading' && <LoadingSkeleton label="Loading events" />}
      {status === 'error' && (
        <Notice tone="error" title="We could not load events">
          Please check your connection and try again.
          <button type="button" onClick={() => void loadEvents(draftFilters)}>Try again</button>
        </Notice>
      )}
      {status === 'success' && events.length === 0 && <EmptyState title="No events found">Try clearing or changing your filters.</EmptyState>}
      {status === 'success' && events.length > 0 && <EventGrid events={events} />}
    </div>
  );
}
