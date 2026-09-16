import { useEffect, useRef, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import type { Attendee, EventSummary } from '../../api/types';

interface AttendeeDialogProps {
  event: EventSummary | null;
  attendees: Attendee[];
  status: 'loading' | 'success' | 'error';
  onClose(): void;
}

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

export function AttendeeDialog({ event, attendees, status, onClose }: AttendeeDialogProps) {
  const closeButton = useRef<HTMLButtonElement>(null);
  const trigger = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!event) {
      trigger.current?.focus();
      trigger.current = null;
      return;
    }
    trigger.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    closeButton.current?.focus();
  }, [event]);

  useEffect(() => {
    if (!event) return;
    const onKeyDown = (keyEvent: KeyboardEvent) => {
      if (keyEvent.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [event, onClose]);

  const trapFocus = (keyboardEvent: ReactKeyboardEvent<HTMLElement>) => {
    if (keyboardEvent.key !== 'Tab') return;
    const focusable = keyboardEvent.currentTarget.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])');
    if (!focusable.length) {
      keyboardEvent.preventDefault();
      return;
    }
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const current = document.activeElement;
    if (keyboardEvent.shiftKey && (current === first || !keyboardEvent.currentTarget.contains(current))) {
      keyboardEvent.preventDefault();
      last.focus();
    } else if (!keyboardEvent.shiftKey && (current === last || !keyboardEvent.currentTarget.contains(current))) {
      keyboardEvent.preventDefault();
      first.focus();
    }
  };

  if (!event) return null;

  return (
    <div className="dialog-backdrop">
      <section className="attendee-dialog" role="dialog" aria-modal="true" aria-labelledby="attendee-dialog-title" onKeyDown={trapFocus}>
        <div className="dialog-heading">
          <div>
            <p className="eyebrow">Event attendees</p>
            <h2 id="attendee-dialog-title">{event.title}</h2>
          </div>
          <button ref={closeButton} type="button" className="button-secondary" onClick={onClose}>Close attendees</button>
        </div>
        {status === 'loading' && <p role="status">Loading attendees…</p>}
        {status === 'error' && <p role="alert">We could not load attendees. Please close this dialog and try again.</p>}
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
    </div>
  );
}
