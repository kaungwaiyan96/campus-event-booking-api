import { createPortal } from 'react-dom';
import type { Attendee, EventSummary } from '../../api/types';
import { useModalDialog } from '../../components/useModalDialog';

interface AttendeeDialogProps {
  event: EventSummary | null;
  attendees: Attendee[];
  status: 'loading' | 'success' | 'error';
  onClose(): void;
  onRetry(): void;
}

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

export function AttendeeDialog({ event, attendees, status, onClose, onRetry }: AttendeeDialogProps) {
  const { dialogRef, headingRef, trapFocus } = useModalDialog({ isOpen: Boolean(event), onClose });

  if (!event) return null;

  return createPortal(
    <div className="dialog-backdrop">
      <section ref={dialogRef} className="attendee-dialog" role="dialog" aria-modal="true" aria-labelledby="attendee-dialog-title" onKeyDown={trapFocus}>
        <div className="dialog-heading">
          <div>
            <p className="eyebrow">Event attendees</p>
            <h2 ref={headingRef} id="attendee-dialog-title" tabIndex={-1}>{event.title}</h2>
          </div>
          <button type="button" className="button-secondary" onClick={onClose}>Close attendees</button>
        </div>
        {status === 'loading' && <p role="status">Loading attendees…</p>}
        {status === 'error' && (
          <div className="attendee-error" role="alert">
            <p>We could not load attendees. Please try again.</p>
            <button type="button" className="button-secondary" onClick={onRetry}>Try again</button>
          </div>
        )}
        {status === 'success' && (attendees.length ? (
          <ul className="attendee-list">
            {attendees.map((attendee) => (
              <li key={attendee.bookingId}>
                <strong>{attendee.student.name}</strong>
                <a href={`mailto:${attendee.student.email}`}>{attendee.student.email}</a>
                <span>Booked {formatDateTime(attendee.bookedAt)}</span>
              </li>
            ))}
          </ul>
        ) : <p>No attendees have booked this event yet.</p>)}
      </section>
    </div>,
    document.body,
  );
}
