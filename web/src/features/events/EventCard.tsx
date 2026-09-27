import { Link } from 'react-router-dom';
import type { EventSummary } from '../../api/types';

function formatSchedule(startTime: string, endTime: string): string {
  const start = new Date(startTime);
  const end = new Date(endTime);
  const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' });
  const timeFormat = new Intl.DateTimeFormat(undefined, { timeStyle: 'short' });
  const startDate = dateFormat.format(start);
  const endDate = dateFormat.format(end);

  if (startDate === endDate) {
    return `${startDate} · ${timeFormat.format(start)}–${timeFormat.format(end)}`;
  }

  return `${startDate}, ${timeFormat.format(start)} – ${endDate}, ${timeFormat.format(end)}`;
}

interface EventCardProps {
  event: EventSummary;
}

export function EventCard({ event }: EventCardProps) {
  return (
    <article className="event-card">
      <div className="event-card-main">
        <p className="eyebrow">{event.venueName}</p>
        <h2>{event.title}</h2>
        <p className="event-schedule">{formatSchedule(event.startTime, event.endTime)}</p>
      </div>
      <div className="event-card-footer">
        <p className="event-capacity"><strong>{event.remainingCapacity}</strong> places remaining</p>
        <p className="event-organizer">Hosted by {event.organizer.name}</p>
        <Link className="text-link" to={`/events/${event.id}`} aria-label={`View details for ${event.title}`}>View event <span aria-hidden="true">↗</span></Link>
      </div>
    </article>
  );
}
