import { useCallback, useEffect, useRef, useState } from 'react';
import { cancelBooking, getMyBookings } from '../api/bookings';
import type { Booking } from '../api/types';
import { useApi } from '../api/useApi';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { EmptyState } from '../components/EmptyState';
import { LoadingSkeleton } from '../components/LoadingSkeleton';
import { Notice } from '../components/Notice';
import { useToast } from '../components/ToastProvider';
import { BookingCard } from '../features/bookings/BookingCard';

export function MyBookingsPage() {
  const client = useApi();
  const clientRef = useRef(client);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const requestVersion = useRef(0);
  const { notify } = useToast();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);

  clientRef.current = client;

  const loadBookings = useCallback(async () => {
    const version = ++requestVersion.current;
    setStatus('loading');
    try {
      const result = await getMyBookings(clientRef.current);
      if (version !== requestVersion.current) return;
      setBookings(result);
      setStatus('success');
    } catch {
      if (version !== requestVersion.current) return;
      setStatus('error');
    }
  }, []);

  useEffect(() => {
    void loadBookings();
    return () => { requestVersion.current += 1; };
  }, [loadBookings]);

  const confirmCancellation = async () => {
    if (!selectedBooking || isCancelling) return;

    setIsCancelling(true);
    try {
      const result = await cancelBooking(client, selectedBooking.id);
      setBookings((current) => current.map((booking) => booking.id === result.booking.id ? result.booking : booking));
      setSelectedBooking(null);
      notify({ tone: 'success', message: result.message || 'Booking cancelled.' });
    } catch (error) {
      notify({ tone: 'error', message: error instanceof Error ? error.message : 'We could not cancel this booking. Please try again.' });
    } finally {
      setIsCancelling(false);
    }
  };

  if (status === 'loading') return <LoadingSkeleton label="Loading your bookings" rows={3} />;
  if (status === 'error') {
    return (
      <Notice tone="error" title="We could not load your bookings">
        <button type="button" onClick={() => void loadBookings()}>Try again</button>
      </Notice>
    );
  }

  return (
    <section className="bookings-page" aria-labelledby="my-bookings-title">
      <header>
        <p className="eyebrow">Student services</p>
        <h1 ref={headingRef} id="my-bookings-title" tabIndex={-1}>My bookings</h1>
        <p>Review the campus events you have reserved.</p>
      </header>
      {bookings.length === 0 ? (
        <EmptyState title="No bookings yet">Browse events to reserve your place.</EmptyState>
      ) : (
        <div className="booking-grid">
          {bookings.map((booking) => <BookingCard key={booking.id} booking={booking} onCancel={setSelectedBooking} />)}
        </div>
      )}
      <ConfirmDialog
        isOpen={selectedBooking !== null}
        title="Cancel booking"
        confirmLabel="Confirm cancellation"
        isConfirming={isCancelling}
        fallbackFocusRef={headingRef}
        onCancel={() => setSelectedBooking(null)}
        onConfirm={() => void confirmCancellation()}
      >
        <p>Cancel your place for <strong>{selectedBooking?.event.title}</strong>? You can book again if places remain.</p>
      </ConfirmDialog>
    </section>
  );
}
