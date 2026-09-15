import type { Booking } from '../../api/types';

interface BookingCardProps {
  booking: Booking;
  onCancel(booking: Booking): void;
}

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

export function BookingCard({ booking, onCancel }: BookingCardProps) {
  const isConfirmed = booking.status === 'CONFIRMED';

  return (
    <article className={`booking-card booking-${booking.status.toLowerCase()}`} aria-labelledby={`booking-${booking.id}-title`}>
      <div className="booking-card-header">
        <p className="eyebrow">{booking.event.venueName}</p>
        <span className="booking-status" aria-label={`Booking status: ${isConfirmed ? 'Confirmed' : 'Cancelled'}`}>
          {isConfirmed ? 'Confirmed' : 'Cancelled'}
        </span>
      </div>
      <h2 id={`booking-${booking.id}-title`}>{booking.event.title}</h2>
      <p>{formatDateTime(booking.event.startTime)} – {formatDateTime(booking.event.endTime)}</p>
      <p>{booking.event.venueAddress}</p>
      {isConfirmed && (
        <button type="button" className="button-secondary" onClick={() => onCancel(booking)}>
          Cancel booking for {booking.event.title}
        </button>
      )}
    </article>
  );
}
