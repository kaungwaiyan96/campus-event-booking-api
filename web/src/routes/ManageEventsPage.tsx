import { useCallback, useEffect, useRef, useState } from 'react';
import { createEvent, deleteEvent, getAttendees, listEvents, updateEvent } from '../api/events';
import type { Attendee, EventInput, EventSummary, Role } from '../api/types';
import { useApi } from '../api/useApi';
import { useAuth } from '../auth/useAuth';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { EmptyState } from '../components/EmptyState';
import { LoadingSkeleton } from '../components/LoadingSkeleton';
import { Notice } from '../components/Notice';
import { useToast } from '../components/ToastProvider';
import { AttendeeDialog } from '../features/manage/AttendeeDialog';
import { EventForm } from '../features/manage/EventForm';
import { ManagedEventCard } from '../features/manage/ManagedEventCard';

type LoadStatus = 'loading' | 'success' | 'error';

function isEventManageable(event: EventSummary, profileId: string, role: Role): boolean {
  return role === 'ADMIN' || event.organizer.id === profileId;
}

export function ManageEventsPage() {
  const client = useApi();
  const clientRef = useRef(client);
  const { profile } = useAuth();
  const { notify } = useToast();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const requestVersion = useRef(0);
  const [events, setEvents] = useState<EventSummary[]>([]);
  const [status, setStatus] = useState<LoadStatus>('loading');
  const [formEvent, setFormEvent] = useState<EventSummary | null | undefined>(undefined);
  const [isSaving, setIsSaving] = useState(false);
  const [eventToDelete, setEventToDelete] = useState<EventSummary | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [attendeeEvent, setAttendeeEvent] = useState<EventSummary | null>(null);
  const [attendees, setAttendees] = useState<Attendee[]>([]);
  const [attendeeStatus, setAttendeeStatus] = useState<LoadStatus>('loading');

  clientRef.current = client;

  const loadEvents = useCallback(async () => {
    const version = ++requestVersion.current;
    setStatus('loading');
    try {
      const result = await listEvents(clientRef.current, {});
      if (version !== requestVersion.current) return;
      setEvents(result);
      setStatus('success');
    } catch {
      if (version !== requestVersion.current) return;
      setStatus('error');
    }
  }, []);

  useEffect(() => {
    void loadEvents();
    return () => { requestVersion.current += 1; };
  }, [loadEvents]);

  if (!profile || (profile.role !== 'ORGANIZER' && profile.role !== 'ADMIN')) {
    return <Notice tone="error" title="You do not have permission to manage events">Please return to the events page.</Notice>;
  }

  const openAttendees = async (event: EventSummary) => {
    setAttendeeEvent(event);
    setAttendees([]);
    setAttendeeStatus('loading');
    try {
      const result = await getAttendees(client, event.id);
      setAttendees(result);
      setAttendeeStatus('success');
    } catch {
      setAttendeeStatus('error');
    }
  };

  const saveEvent = async (input: EventInput) => {
    const isEditing = Boolean(formEvent);
    setIsSaving(true);
    try {
      if (formEvent) {
        await updateEvent(client, formEvent.id, input);
      } else {
        await createEvent(client, input);
      }
      setFormEvent(undefined);
      notify({ tone: 'success', message: isEditing ? 'Event updated.' : 'Event created.' });
      await loadEvents();
    } catch (error) {
      notify({ tone: 'error', message: error instanceof Error ? error.message : 'We could not save this event. Please try again.' });
    } finally {
      setIsSaving(false);
    }
  };

  const confirmDeletion = async () => {
    if (!eventToDelete || isDeleting) return;
    setIsDeleting(true);
    try {
      const result = await deleteEvent(client, eventToDelete.id);
      setEvents((current) => current.filter((event) => event.id !== eventToDelete.id));
      setEventToDelete(null);
      notify({ tone: 'success', message: result.message || 'Event deleted.' });
    } catch (error) {
      notify({ tone: 'error', message: error instanceof Error ? error.message : 'We could not delete this event. Please try again.' });
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <section className="manage-events-page" aria-labelledby="manage-events-title">
      <header className="manage-events-header">
        <div>
          <p className="eyebrow">Event administration</p>
          <h1 ref={headingRef} id="manage-events-title" tabIndex={-1}>Manage events</h1>
          <p>Create, update, and review attendance for campus events.</p>
        </div>
        <button type="button" onClick={() => setFormEvent(null)}>Create event</button>
      </header>
      {status === 'loading' && <LoadingSkeleton label="Loading events to manage" rows={3} />}
      {status === 'error' && <Notice tone="error" title="We could not load events"><button type="button" onClick={() => void loadEvents()}>Try again</button></Notice>}
      {status === 'success' && events.length === 0 && <EmptyState title="No events to manage">Create the first event for your campus community.</EmptyState>}
      {status === 'success' && events.length > 0 && (
        <div className="managed-event-grid">
          {events.map((event) => {
            const canManage = isEventManageable(event, profile.id, profile.role);
            return <ManagedEventCard key={event.id} event={event} canManage={canManage} onEdit={setFormEvent} onDelete={setEventToDelete} onViewAttendees={(selected) => void openAttendees(selected)} />;
          })}
        </div>
      )}
      {formEvent !== undefined && <EventForm event={formEvent} isSaving={isSaving} onCancel={() => setFormEvent(undefined)} onSubmit={saveEvent} />}
      <ConfirmDialog
        isOpen={eventToDelete !== null}
        title="Delete event"
        confirmLabel="Delete event"
        cancelLabel="Keep event"
        isConfirming={isDeleting}
        fallbackFocusRef={headingRef}
        onCancel={() => setEventToDelete(null)}
        onConfirm={() => void confirmDeletion()}
      >
        <p>Delete <strong>{eventToDelete?.title}</strong>? Existing bookings will also be affected.</p>
      </ConfirmDialog>
      <AttendeeDialog event={attendeeEvent} attendees={attendees} status={attendeeStatus} onClose={() => setAttendeeEvent(null)} />
    </section>
  );
}
