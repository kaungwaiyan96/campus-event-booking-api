import { Link } from 'react-router-dom';
import type { EventSummary } from '../../api/types';

function formatSchedule(startTime: string, endTime: string): string {
  const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' });
  return `${dateFormat.format(new Date(startTime))} – ${dateFormat.format(new Date(endTime))}`;
}

interface EventCardProps {
  event: EventSummary;
}

export function EventCard({ event }: EventCardProps) {
  return (
    <article className="event-card">
      <p className="eyebrow">{event.venueName}</p>
      <h2>{event.title}</h2>
      <p className="event-schedule">{formatSchedule(event.startTime, event.endTime)}</p>
      <p className="event-capacity"><strong>{event.remainingCapacity}</strong> places remaining</p>
      <p className="event-organizer">Hosted by {event.organizer.name}</p>
      <Link className="text-link" to={`/events/${event.id}`} aria-label={`View details for ${event.title}`}>Details</Link>
    </article>
  );
}
