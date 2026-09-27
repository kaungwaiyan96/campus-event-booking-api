import type { EventSummary } from '../../api/types';
import { EventCard } from './EventCard';

interface EventGridProps {
  events: EventSummary[];
}

export function EventGrid({ events }: EventGridProps) {
  return (
    <section className="event-grid" aria-label="Event results">
      {events.map((event) => <EventCard key={event.id} event={event} />)}
    </section>
  );
}
