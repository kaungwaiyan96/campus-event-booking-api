import type { EventSummary } from '../../api/types';

interface ManagedEventCardProps {
  event: EventSummary;
  canManage: boolean;
  onEdit(event: EventSummary): void;
  onDelete(event: EventSummary): void;
  onViewAttendees(event: EventSummary): void;
}

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

export function ManagedEventCard({ event, canManage, onEdit, onDelete, onViewAttendees }: ManagedEventCardProps) {
  return (
    <article className="managed-event-card" aria-labelledby={`managed-event-${event.id}-title`}>
      <div>
        <p className="eyebrow">{event.venueName}</p>
        <h2 id={`managed-event-${event.id}-title`}>{event.title}</h2>
        <p>{formatDateTime(event.startTime)} – {formatDateTime(event.endTime)}</p>
        <p>{event.confirmedBookings} booked · {event.remainingCapacity} places remaining</p>
        <p className="managed-event-organizer">Organized by {event.organizer.name}</p>
      </div>
      {canManage && (
        <div className="managed-event-actions">
          <button type="button" className="button-secondary" onClick={() => onEdit(event)}>Edit {event.title}</button>
          <button type="button" className="button-secondary" onClick={() => onViewAttendees(event)}>View attendees for {event.title}</button>
          <button type="button" className="button-danger" onClick={() => onDelete(event)}>Delete {event.title}</button>
        </div>
      )}
    </article>
  );
}
