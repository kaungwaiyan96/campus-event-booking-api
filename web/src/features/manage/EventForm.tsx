import { cloneElement, useEffect, useState, type FormEvent, type ReactElement, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import type { EventInput, EventSummary } from '../../api/types';
import { useModalDialog } from '../../components/useModalDialog';

interface EventFormProps {
  event?: EventSummary | null;
  isSaving: boolean;
  onCancel(): void;
  onSubmit(input: EventInput): Promise<void>;
}

type FormValues = {
  title: string;
  description: string;
  venueName: string;
  venueAddress: string;
  mapImageUrl: string;
  startTime: string;
  endTime: string;
  capacity: string;
};

type FormErrors = Partial<Record<keyof FormValues, string>>;

function toDateTimeLocal(value?: string): string {
  if (!value) return '';
  const date = new Date(value);
  const localDate = new Date(date.getTime() - (date.getTimezoneOffset() * 60_000));
  return localDate.toISOString().slice(0, 16);
}

function initialValues(event?: EventSummary | null): FormValues {
  return {
    title: event?.title ?? '',
    description: event?.description ?? '',
    venueName: event?.venueName ?? '',
    venueAddress: event?.venueAddress ?? '',
    mapImageUrl: event?.mapImageUrl ?? '',
    startTime: toDateTimeLocal(event?.startTime),
    endTime: toDateTimeLocal(event?.endTime),
    capacity: event ? String(event.capacity) : '1',
  };
}

function validate(values: FormValues): FormErrors {
  const errors: FormErrors = {};
  const requiredFields: Array<keyof Pick<FormValues, 'title' | 'description' | 'venueName' | 'venueAddress' | 'startTime' | 'endTime'>> = [
    'title', 'description', 'venueName', 'venueAddress', 'startTime', 'endTime',
  ];

  for (const field of requiredFields) {
    if (!values[field].trim()) errors[field] = `${field === 'venueName' ? 'Venue name' : field === 'venueAddress' ? 'Venue address' : field === 'startTime' ? 'Start time' : field === 'endTime' ? 'End time' : field[0].toUpperCase() + field.slice(1)} is required.`;
  }

  const capacity = Number(values.capacity);
  if (!Number.isInteger(capacity) || capacity < 1) errors.capacity = 'Capacity must be at least 1.';

  if (values.startTime && values.endTime && new Date(values.startTime) >= new Date(values.endTime)) {
    errors.endTime = 'End time must be after start time.';
  }

  return errors;
}

export function EventForm({ event, isSaving, onCancel, onSubmit }: EventFormProps) {
  const [values, setValues] = useState<FormValues>(() => initialValues(event));
  const [errors, setErrors] = useState<FormErrors>({});
  const isEditing = Boolean(event);
  const { dialogRef, headingRef, trapFocus } = useModalDialog({ isOpen: true, isPending: isSaving, onClose: onCancel });

  useEffect(() => {
    setValues(initialValues(event));
    setErrors({});
  }, [event]);

  const setValue = (field: keyof FormValues, value: string) => {
    setValues((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
  };

  const submit = async (eventSubmit: FormEvent<HTMLFormElement>) => {
    eventSubmit.preventDefault();
    const formErrors = validate(values);
    setErrors(formErrors);
    if (Object.keys(formErrors).length) return;

    await onSubmit({
      title: values.title.trim(),
      description: values.description.trim(),
      venueName: values.venueName.trim(),
      venueAddress: values.venueAddress.trim(),
      ...(values.mapImageUrl.trim() ? { mapImageUrl: values.mapImageUrl.trim() } : {}),
      startTime: new Date(values.startTime).toISOString(),
      endTime: new Date(values.endTime).toISOString(),
      capacity: Number(values.capacity),
    });
  };

  return createPortal(
    <div className="dialog-backdrop">
      <section ref={dialogRef} className="event-form-dialog" role="dialog" aria-modal="true" aria-busy={isSaving} aria-labelledby="event-form-dialog-title" tabIndex={isSaving ? -1 : undefined} onKeyDown={trapFocus}>
        <header>
          <p className="eyebrow">Event administration</p>
          <h2 ref={headingRef} id="event-form-dialog-title" tabIndex={-1}>{isEditing ? 'Edit event' : 'Create event'}</h2>
        </header>
        <form className="event-form" noValidate onSubmit={(submit)}>
          <Field label="Title" error={errors.title}><input value={values.title} onChange={(input) => setValue('title', input.target.value)} /></Field>
          <Field label="Description" error={errors.description}><textarea value={values.description} onChange={(input) => setValue('description', input.target.value)} /></Field>
          <Field label="Venue name" error={errors.venueName}><input value={values.venueName} onChange={(input) => setValue('venueName', input.target.value)} /></Field>
          <Field label="Venue address" error={errors.venueAddress}><input value={values.venueAddress} onChange={(input) => setValue('venueAddress', input.target.value)} /></Field>
          <Field label="Map image URL"><input type="url" value={values.mapImageUrl} onChange={(input) => setValue('mapImageUrl', input.target.value)} /></Field>
          <Field label="Start date and time" error={errors.startTime}><input type="datetime-local" value={values.startTime} onChange={(input) => setValue('startTime', input.target.value)} /></Field>
          <Field label="End date and time" error={errors.endTime}><input type="datetime-local" value={values.endTime} onChange={(input) => setValue('endTime', input.target.value)} /></Field>
          <Field label="Capacity" error={errors.capacity}><input type="number" min="1" step="1" value={values.capacity} onChange={(input) => setValue('capacity', input.target.value)} /></Field>
          <div className="dialog-actions">
            <button type="button" className="button-secondary" disabled={isSaving} onClick={onCancel}>Cancel</button>
            <button type="submit" disabled={isSaving}>{isSaving ? 'Saving…' : isEditing ? 'Save changes' : 'Create event'}</button>
          </div>
        </form>
      </section>
    </div>,
    document.body,
  );
}

function Field({ label, error, children }: { label: string; error?: string; children: ReactNode }) {
  const id = `event-form-${label.toLowerCase().replaceAll(' ', '-')}`;
  const errorId = `${id}-error`;
  const element = children as ReactElement<{ id?: string; 'aria-describedby'?: string }>;

  return (
    <div className="field-group">
      <label htmlFor={id}>{label}</label>
      {cloneElement(element, { id, 'aria-describedby': error ? errorId : undefined })}
      {error && <p id={errorId} className="field-error" role="alert">{error}</p>}
    </div>
  );
}
