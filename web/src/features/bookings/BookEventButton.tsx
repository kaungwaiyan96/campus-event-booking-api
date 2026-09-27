import { createBooking } from '../../api/bookings';
import { ApiError } from '../../api/client';
import { useApi } from '../../api/useApi';
import { useAuth } from '../../auth/useAuth';
import { useToast } from '../../components/ToastProvider';
import { useState } from 'react';

interface BookEventButtonProps {
  eventId: string;
  remainingCapacity: number;
  onBooked?(): void;
}

function bookingMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.code === 'ALREADY_BOOKED') return 'You already have a booking for this event.';
    if (error.code === 'CAPACITY_EXCEEDED') return 'This event is now full.';
    return error.message;
  }

  return 'We could not complete your booking. Please try again.';
}

export function BookEventButton({ eventId, remainingCapacity, onBooked }: BookEventButtonProps) {
  const client = useApi();
  const { profile } = useAuth();
  const { notify } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const canBook = profile?.role === 'STUDENT' || profile?.role === 'ADMIN';
  const isFull = remainingCapacity === 0;

  if (!canBook) return null;

  const handleBook = async () => {
    if (isSubmitting || isFull) return;

    setIsSubmitting(true);
    try {
      await createBooking(client, eventId);
      notify({ tone: 'success', message: 'Booking confirmed.' });
      onBooked?.();
    } catch (error) {
      notify({ tone: 'error', message: bookingMessage(error) });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <button type="button" onClick={() => void handleBook()} disabled={isSubmitting || isFull}>
      {isSubmitting ? 'Booking…' : isFull ? 'Event full' : 'Book event'}
    </button>
  );
}
